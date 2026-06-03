import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { WorkflowNode, WorkflowEdge, CreateInstanceInput, TransitionInput } from "./types";

type JsonNode = WorkflowNode;
type JsonEdge = WorkflowEdge;

async function findWorkflowByType(type: string) {
  const workflow = await prisma.workflow.findFirst({ where: { type } });
  if (!workflow) throw new Error(`工作流模板不存在: ${type}`);
  return workflow;
}

function findNextNode(currentNode: string, trigger: string, edges: JsonEdge[]): JsonEdge | null {
  return edges.find((e) => e.from === currentNode && e.trigger === trigger) ?? null;
}

export async function createInstance(input: CreateInstanceInput) {
  const workflow = await findWorkflowByType(input.workflowType);
  const nodes = workflow.nodes as unknown as JsonNode[];
  if (nodes.length === 0) throw new Error("工作流模板无节点");

  const startNode = nodes[0].key;

  const instance = await prisma.workflowInstance.create({
    data: {
      workflowId: workflow.id,
      currentNode: startNode,
      status: "running",
      targetType: input.targetType,
      targetId: input.targetId,
      context: (input.context ?? {}) as Prisma.InputJsonValue,
      startedAt: new Date(),
    },
  });

  await prisma.workflowLog.create({
    data: {
      instanceId: instance.id,
      fromNode: "",
      toNode: startNode,
      operator: (input.context?.operator as string) ?? "system",
      action: "start",
      comment: "流程启动",
    },
  });

  return instance;
}

export async function transition(input: TransitionInput) {
  const instance = await prisma.workflowInstance.findUnique({
    where: { id: input.instanceId },
    include: { workflow: true },
  });

  if (!instance) throw new Error("工作流实例不存在");
  if (instance.status !== "running") throw new Error(`工作流已结束，状态: ${instance.status}`);

  const edges = instance.workflow.edges as unknown as JsonEdge[];
  const next = findNextNode(instance.currentNode, input.trigger, edges);

  if (!next) {
    throw new Error(`无效流转: 从 "${instance.currentNode}" 通过 "${input.trigger}"`);
  }

  const isEndNode = !edges.some((e) => e.from === next.to);

  const updated = await prisma.workflowInstance.update({
    where: { id: instance.id },
    data: {
      currentNode: next.to,
      status: isEndNode ? "completed" : "running",
      endedAt: isEndNode ? new Date() : null,
    },
  });

  await prisma.workflowLog.create({
    data: {
      instanceId: instance.id,
      fromNode: next.from,
      toNode: next.to,
      operator: input.operator ?? "system",
      action: input.trigger,
      comment: input.comment ?? "",
    },
  });

  return { instance: updated, fromNode: next.from, toNode: next.to, isEnd: isEndNode };
}

export async function listInstances(params: {
  workflowType?: string; targetType?: string; status?: string; limit?: number; offset?: number;
}) {
  const where: Record<string, unknown> = {};
  if (params.status) where.status = params.status;
  if (params.targetType) where.targetType = params.targetType;
  if (params.workflowType) {
    const workflow = await findWorkflowByType(params.workflowType);
    where.workflowId = workflow.id;
  }

  const [instances, total] = await Promise.all([
    prisma.workflowInstance.findMany({
      where,
      include: { workflow: true, logs: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "desc" },
      take: params.limit ?? 20,
      skip: params.offset ?? 0,
    }),
    prisma.workflowInstance.count({ where }),
  ]);

  return { instances, total };
}

export async function getInstance(id: string) {
  const instance = await prisma.workflowInstance.findUnique({
    where: { id },
    include: { workflow: true, logs: { orderBy: { createdAt: "asc" } } },
  });
  if (!instance) throw new Error("实例不存在");
  return instance;
}

export function getAvailableTransitions(currentNode: string, edges: JsonEdge[]): JsonEdge[] {
  return edges.filter((e) => e.from === currentNode);
}

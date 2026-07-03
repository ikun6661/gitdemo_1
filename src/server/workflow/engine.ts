import { prisma } from "@/lib/prisma";
import {
  findNextEdge,
  isEndNode,
  parseWorkflowDefinition,
} from "./definition";
import type { CreateInstanceInput, TransitionInput, WorkflowEdge } from "./types";

async function findWorkflowByType(type: string) {
  const workflow = await prisma.workflow.findFirst({ where: { type } });
  if (!workflow) throw new Error(`工作流模板不存在: ${type}`);
  return workflow;
}

export async function createInstance(input: CreateInstanceInput) {
  const workflow = await findWorkflowByType(input.workflowType);
  const definition = parseWorkflowDefinition(workflow.nodes, workflow.edges);
  if (definition.nodes.length === 0) {
    throw new Error("工作流模板无节点");
  }

  const startNode = definition.nodes[0].key;

  const instance = await prisma.workflowInstance.create({
    data: {
      workflowId: workflow.id,
      currentNode: startNode,
      status: "running",
      targetType: input.targetType,
      targetId: input.targetId,
      context: JSON.stringify(input.context ?? {}),
      startedAt: new Date(),
    },
  });

  await prisma.workflowLog.create({
    data: {
      instanceId: instance.id,
      fromNode: "",
      toNode: startNode,
      operator: input.context?.operator ?? "system",
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

  const definition = parseWorkflowDefinition(
    instance.workflow.nodes,
    instance.workflow.edges,
  );
  const next = findNextEdge(
    instance.currentNode,
    input.trigger,
    definition.edges,
  );

  if (!next) {
    throw new Error(`无效流转: 从 "${instance.currentNode}" 通过 "${input.trigger}"`);
  }

  const hasEnded = isEndNode(next.to, definition.edges);

  const updated = await prisma.workflowInstance.update({
    where: { id: instance.id },
    data: {
      currentNode: next.to,
      status: hasEnded ? "completed" : "running",
      endedAt: hasEnded ? new Date() : null,
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

  return { instance: updated, fromNode: next.from, toNode: next.to, isEnd: hasEnded };
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

  const [rawInstances, total] = await Promise.all([
    prisma.workflowInstance.findMany({
      where,
      include: { workflow: true, logs: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "desc" },
      take: params.limit ?? 20,
      skip: params.offset ?? 0,
    }),
    prisma.workflowInstance.count({ where }),
  ]);

  // 解析 JSON 字段，供前端直接消费。
  const instances = rawInstances.map((inst) => ({
    ...inst,
    context: typeof inst.context === "string" ? JSON.parse(inst.context) : inst.context,
    workflow: {
      ...inst.workflow,
      ...parseWorkflowDefinition(inst.workflow.nodes, inst.workflow.edges),
    },
  }));

  return { instances, total };
}

export async function getInstance(id: string) {
  const instance = await prisma.workflowInstance.findUnique({
    where: { id },
    include: { workflow: true, logs: { orderBy: { createdAt: "asc" } } },
  });
  if (!instance) throw new Error("实例不存在");

  // 解析 JSON 字段，供前端直接消费。
  return {
    ...instance,
    context: typeof instance.context === "string" ? JSON.parse(instance.context) : instance.context,
    workflow: {
      ...instance.workflow,
      ...parseWorkflowDefinition(instance.workflow.nodes, instance.workflow.edges),
    },
  };
}

export function getAvailableTransitions(currentNode: string, edges: WorkflowEdge[]): WorkflowEdge[] {
  return edges.filter((e) => e.from === currentNode);
}

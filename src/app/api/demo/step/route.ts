import { NextRequest, NextResponse } from "next/server";
import { transition, getInstance } from "@/server/workflow/engine";

const STEPS: Record<string, string[]> = {
  order_flow: ["pay", "ship", "receive", "complete"],
  refund_approval: ["submit", "cs_approve", "manager_approve"],
  product_approval: ["submit", "approve"],
};

export async function POST(req: NextRequest) {
  const { instanceId, scenario, stepIndex } = await req.json();
  const triggers = STEPS[scenario];
  if (!triggers || stepIndex >= triggers.length) return NextResponse.json({ error: "流程已完成" }, { status: 400 });

  const trigger = triggers[stepIndex];
  const result = await transition({ instanceId, trigger, operator: "演示系统", comment: `演示步骤 ${stepIndex + 1}` });
  const instance = await getInstance(instanceId);
  const nodes = instance.workflow.nodes as unknown as { key: string; label: string }[];
  const currentNode = nodes.find((n) => n.key === instance.currentNode);

  return NextResponse.json({
    success: true, stepIndex: stepIndex + 1, currentStep: stepIndex + 1,
    totalSteps: triggers.length, currentNodeLabel: currentNode?.label,
    isComplete: stepIndex + 1 >= triggers.length || result.isEnd,
  });
}

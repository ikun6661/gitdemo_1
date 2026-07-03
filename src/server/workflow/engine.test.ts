import { beforeEach, describe, expect, it, vi } from "vitest";
import { transition } from "./engine";

const mocks = vi.hoisted(() => ({
  prismaWorkflowInstanceFindUnique: vi.fn(),
  prismaWorkflowInstanceUpdate: vi.fn(),
  prismaWorkflowLogCreate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    workflowInstance: {
      findUnique: mocks.prismaWorkflowInstanceFindUnique,
      update: mocks.prismaWorkflowInstanceUpdate,
    },
    workflowLog: {
      create: mocks.prismaWorkflowLogCreate,
    },
  },
}));

describe("workflow transition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the provided transaction client for instance updates and logs", async () => {
    const txWorkflowInstanceFindUnique = vi.fn().mockResolvedValue({
      id: "workflow-instance-1",
      currentNode: "paid",
      status: "running",
      workflow: {
        nodes: JSON.stringify([
          { key: "paid", label: "Paid" },
          { key: "shipped", label: "Shipped" },
        ]),
        edges: JSON.stringify([
          {
            from: "paid",
            to: "shipped",
            trigger: "ship",
            label: "Ship",
          },
        ]),
      },
    });
    const txWorkflowInstanceUpdate = vi.fn().mockResolvedValue({
      id: "workflow-instance-1",
      currentNode: "shipped",
      status: "completed",
    });
    const txWorkflowLogCreate = vi.fn().mockResolvedValue({
      id: "workflow-log-1",
    });
    const tx = {
      workflowInstance: {
        findUnique: txWorkflowInstanceFindUnique,
        update: txWorkflowInstanceUpdate,
      },
      workflowLog: {
        create: txWorkflowLogCreate,
      },
    } as unknown as NonNullable<Parameters<typeof transition>[1]>;

    const result = await transition(
      {
        instanceId: "workflow-instance-1",
        trigger: "ship",
        operator: "ops-user",
        comment: "ready",
      },
      tx,
    );

    expect(result).toMatchObject({
      instance: {
        id: "workflow-instance-1",
        currentNode: "shipped",
        status: "completed",
      },
      fromNode: "paid",
      toNode: "shipped",
      isEnd: true,
    });
    expect(txWorkflowInstanceFindUnique).toHaveBeenCalledWith({
      where: { id: "workflow-instance-1" },
      include: { workflow: true },
    });
    expect(txWorkflowInstanceUpdate).toHaveBeenCalledWith({
      where: { id: "workflow-instance-1" },
      data: {
        currentNode: "shipped",
        status: "completed",
        endedAt: expect.any(Date) as Date,
      },
    });
    expect(txWorkflowLogCreate).toHaveBeenCalledWith({
      data: {
        instanceId: "workflow-instance-1",
        fromNode: "paid",
        toNode: "shipped",
        operator: "ops-user",
        action: "ship",
        comment: "ready",
      },
    });
    expect(mocks.prismaWorkflowInstanceFindUnique).not.toHaveBeenCalled();
    expect(mocks.prismaWorkflowInstanceUpdate).not.toHaveBeenCalled();
    expect(mocks.prismaWorkflowLogCreate).not.toHaveBeenCalled();
  });
});

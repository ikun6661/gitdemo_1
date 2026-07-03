import { describe, expect, it } from "vitest";
import {
  findNextEdge,
  isEndNode,
  parseWorkflowDefinition,
} from "./definition";

const nodesJson = JSON.stringify([
  { key: "pending_payment", label: "待支付" },
  { key: "paid", label: "已支付" },
  { key: "shipped", label: "已发货" },
]);

const edgesJson = JSON.stringify([
  { from: "pending_payment", to: "paid", trigger: "pay", label: "支付" },
  { from: "paid", to: "shipped", trigger: "ship", label: "发货" },
]);

describe("workflow definition helpers", () => {
  it("parses nodes and edges from JSON strings", () => {
    const definition = parseWorkflowDefinition(nodesJson, edgesJson);

    expect(definition.nodes).toHaveLength(3);
    expect(definition.edges[0]).toEqual({
      from: "pending_payment",
      to: "paid",
      trigger: "pay",
      label: "支付",
    });
  });

  it("finds the next edge by current node and trigger", () => {
    const definition = parseWorkflowDefinition(nodesJson, edgesJson);

    const edge = findNextEdge("pending_payment", "pay", definition.edges);

    expect(edge).toEqual({
      from: "pending_payment",
      to: "paid",
      trigger: "pay",
      label: "支付",
    });
  });

  it("returns null when the transition is not allowed", () => {
    const definition = parseWorkflowDefinition(nodesJson, edgesJson);

    const edge = findNextEdge("pending_payment", "ship", definition.edges);

    expect(edge).toBeNull();
  });

  it("detects end nodes", () => {
    const definition = parseWorkflowDefinition(nodesJson, edgesJson);

    expect(isEndNode("shipped", definition.edges)).toBe(true);
    expect(isEndNode("paid", definition.edges)).toBe(false);
  });
});

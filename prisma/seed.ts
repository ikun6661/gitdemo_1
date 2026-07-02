import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // 按外键依赖顺序清理旧数据。
  await prisma.workflowLog.deleteMany();
  await prisma.workflowInstance.deleteMany();
  await prisma.workflow.deleteMany();
  await prisma.refund.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("demo123456", 10);

  await prisma.user.create({
    data: {
      name: "管理员",
      email: "admin@ecomflow.com",
      passwordHash,
      role: "admin",
    },
  });
  await prisma.user.create({
    data: {
      name: "运营小王",
      email: "operator@ecomflow.com",
      passwordHash,
      role: "operator",
    },
  });
  await prisma.user.create({
    data: {
      name: "演示用户",
      email: "customer@ecomflow.com",
      passwordHash,
      role: "customer",
    },
  });
  console.log("用户创建完成");

  const electronics = await prisma.category.create({
    data: {
      name: "电子产品",
      slug: "electronics",
    },
  });

  await Promise.all([
    prisma.product.create({
      data: {
        name: "iPhone 15",
        description: "Apple iPhone 15 128GB 黑色",
        price: 699900,
        stock: 100,
        categoryId: electronics.id,
        images: JSON.stringify(["/placeholder-iphone.jpg"]),
        status: "published",
      },
    }),
    prisma.product.create({
      data: {
        name: "MacBook Air",
        description: "Apple MacBook Air M3 13英寸 8GB/256GB",
        price: 899900,
        stock: 50,
        categoryId: electronics.id,
        images: JSON.stringify(["/placeholder-macbook.jpg"]),
        status: "published",
      },
    }),
    prisma.product.create({
      data: {
        name: "AirPods Pro",
        description: "Apple AirPods Pro 第二代 USB-C",
        price: 189900,
        stock: 200,
        categoryId: electronics.id,
        images: JSON.stringify(["/placeholder-airpods.jpg"]),
        status: "published",
      },
    }),
    prisma.product.create({
      data: {
        name: "iPad Air",
        description: "Apple iPad Air M2 11英寸 128GB",
        price: 479900,
        stock: 80,
        categoryId: electronics.id,
        images: JSON.stringify(["/placeholder-ipad.jpg"]),
        status: "published",
      },
    }),
    prisma.product.create({
      data: {
        name: "Apple Watch",
        description: "Apple Watch Series 9 GPS 45mm",
        price: 319900,
        stock: 150,
        categoryId: electronics.id,
        images: JSON.stringify(["/placeholder-watch.jpg"]),
        status: "published",
      },
    }),
    prisma.product.create({
      data: {
        name: "AirPods Max",
        description: "Apple AirPods Max 头戴式耳机",
        price: 439900,
        stock: 30,
        categoryId: electronics.id,
        images: JSON.stringify(["/placeholder-airpodsmax.jpg"]),
        status: "pending",
      },
    }),
  ]);
  console.log("商品创建完成");

  await prisma.workflow.create({
    data: {
      name: "订单全链路",
      type: "order_flow",
      nodes: JSON.stringify([
        { key: "pending_payment", label: "待支付" },
        { key: "paid", label: "已支付" },
        { key: "shipped", label: "已发货" },
        { key: "received", label: "已收货" },
        { key: "completed", label: "已完成" },
        { key: "cancelled", label: "已取消" },
        { key: "refunding", label: "退款中" },
        { key: "refunded", label: "已退款" },
      ]),
      edges: JSON.stringify([
        { from: "pending_payment", to: "paid", trigger: "pay", label: "支付" },
        { from: "pending_payment", to: "cancelled", trigger: "cancel", label: "取消" },
        { from: "paid", to: "shipped", trigger: "ship", label: "发货" },
        { from: "paid", to: "cancelled", trigger: "cancel", label: "取消" },
        { from: "shipped", to: "received", trigger: "receive", label: "收货" },
        { from: "shipped", to: "refunding", trigger: "refund", label: "申请退款" },
        { from: "received", to: "completed", trigger: "complete", label: "完成" },
        { from: "received", to: "refunding", trigger: "refund", label: "申请退款" },
        { from: "refunding", to: "refunded", trigger: "approve_refund", label: "退款完成" },
      ]),
    },
  });

  await prisma.workflow.create({
    data: {
      name: "退款审批",
      type: "refund_approval",
      nodes: JSON.stringify([
        { key: "pending_review", label: "待审核" },
        { key: "cs_review", label: "客服审核" },
        { key: "manager_approval", label: "经理审批" },
        { key: "approved", label: "已通过" },
        { key: "rejected", label: "已驳回" },
      ]),
      edges: JSON.stringify([
        { from: "pending_review", to: "cs_review", trigger: "submit", label: "提交审核" },
        { from: "pending_review", to: "rejected", trigger: "reject", label: "驳回" },
        { from: "cs_review", to: "manager_approval", trigger: "cs_approve", label: "客服通过" },
        { from: "cs_review", to: "rejected", trigger: "cs_reject", label: "客服驳回" },
        { from: "manager_approval", to: "approved", trigger: "manager_approve", label: "经理通过" },
        { from: "manager_approval", to: "rejected", trigger: "manager_reject", label: "经理驳回" },
      ]),
    },
  });

  await prisma.workflow.create({
    data: {
      name: "商品上架审批",
      type: "product_approval",
      nodes: JSON.stringify([
        { key: "draft", label: "草稿" },
        { key: "pending_review", label: "待审核" },
        { key: "published", label: "已上架" },
        { key: "rejected", label: "已驳回" },
      ]),
      edges: JSON.stringify([
        { from: "draft", to: "pending_review", trigger: "submit", label: "提交审核" },
        { from: "pending_review", to: "published", trigger: "approve", label: "审核通过" },
        { from: "pending_review", to: "rejected", trigger: "reject", label: "驳回" },
      ]),
    },
  });

  console.log("工作流模板创建完成");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

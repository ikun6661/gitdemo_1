import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // 按外键依赖顺序清理旧数据。
  await prisma.workflowLog.deleteMany();
  await prisma.workflowInstance.deleteMany();
  await prisma.workflow.deleteMany();
  await prisma.payment.deleteMany();
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

  const products = [
    {
      name: "iPhone 15",
      description: "Apple iPhone 15 128GB 黑色，适合日常拍照、视频和轻办公。",
      shortDescription: "轻巧耐用的 Apple 主力手机",
      price: 699900,
      stock: 100,
      images: ["/placeholder-iphone.jpg"],
      status: "published",
      sellingPoints: ["A16 仿生芯片", "4800 万像素主摄", "USB-C 接口"],
      specs: { storage: "128GB", color: "黑色", screen: "6.1 英寸" },
      seoKeywords: ["iPhone 15", "Apple 手机", "数码电子"],
      aiSummary: "适合想要稳定体验和优秀影像能力的主力机用户。",
    },
    {
      name: "MacBook Air M3",
      description: "Apple MacBook Air M3 13 英寸 8GB/256GB，适合学习、办公和轻量创作。",
      shortDescription: "轻薄长续航的 M3 笔记本",
      price: 899900,
      stock: 50,
      images: ["/placeholder-macbook.jpg"],
      status: "published",
      sellingPoints: ["M3 芯片", "轻薄机身", "全天候续航"],
      specs: { memory: "8GB", storage: "256GB", screen: "13 英寸" },
      seoKeywords: ["MacBook Air", "M3 笔记本", "轻薄本"],
      aiSummary: "适合需要便携办公和稳定续航的学生与职场用户。",
    },
    {
      name: "AirPods Pro 2",
      description: "Apple AirPods Pro 第二代 USB-C，支持主动降噪和空间音频。",
      shortDescription: "降噪表现优秀的真无线耳机",
      price: 189900,
      stock: 200,
      images: ["/placeholder-airpods.jpg"],
      status: "published",
      sellingPoints: ["主动降噪", "空间音频", "USB-C 充电盒"],
      specs: { connector: "USB-C", noiseCanceling: "主动降噪" },
      seoKeywords: ["AirPods Pro", "降噪耳机", "无线耳机"],
      aiSummary: "适合通勤、办公和 Apple 生态用户的高品质耳机。",
    },
    {
      name: "iPad Air M2",
      description: "Apple iPad Air M2 11 英寸 128GB，适合学习、绘画和移动办公。",
      shortDescription: "性能强劲的轻薄平板",
      price: 479900,
      stock: 80,
      images: ["/placeholder-ipad.jpg"],
      status: "published",
      sellingPoints: ["M2 芯片", "支持 Apple Pencil", "11 英寸 Liquid Retina 屏"],
      specs: { storage: "128GB", chip: "M2", screen: "11 英寸" },
      seoKeywords: ["iPad Air", "M2 平板", "Apple 平板"],
      aiSummary: "适合学习、创作和娱乐之间灵活切换的用户。",
    },
    {
      name: "Apple Watch Series 9",
      description: "Apple Watch Series 9 GPS 45mm，支持健康监测和运动记录。",
      shortDescription: "健康与运动管理智能手表",
      price: 319900,
      stock: 150,
      images: ["/placeholder-watch.jpg"],
      status: "published",
      sellingPoints: ["健康监测", "运动记录", "明亮显示屏"],
      specs: { size: "45mm", connectivity: "GPS" },
      seoKeywords: ["Apple Watch", "智能手表", "运动手表"],
      aiSummary: "适合重视健康提醒和运动记录的 Apple 用户。",
    },
    {
      name: "AirPods Max",
      description: "Apple AirPods Max 头戴式耳机，适合沉浸式音乐和影音体验。",
      shortDescription: "高端头戴式降噪耳机",
      price: 439900,
      stock: 30,
      images: ["/placeholder-airpodsmax.jpg"],
      status: "pending",
      sellingPoints: ["高保真音质", "主动降噪", "舒适头戴设计"],
      specs: { type: "头戴式", noiseCanceling: "主动降噪" },
      seoKeywords: ["AirPods Max", "头戴耳机", "高端耳机"],
      aiSummary: "适合追求沉浸式听感和高级质感的用户。",
    },
  ];

  await Promise.all(
    products.map((product) =>
      prisma.product.create({
        data: {
          name: product.name,
          description: product.description,
          shortDescription: product.shortDescription,
          price: product.price,
          stock: product.stock,
          categoryId: electronics.id,
          images: JSON.stringify(product.images),
          status: product.status,
          sellingPoints: JSON.stringify(product.sellingPoints),
          specs: JSON.stringify(product.specs),
          seoKeywords: JSON.stringify(product.seoKeywords),
          aiSummary: product.aiSummary,
          aiGeneratedAt: new Date(),
        },
      }),
    ),
  );
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

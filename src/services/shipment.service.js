import shiprocket from "../config/shiprocket.js";

export const createShipment = async (order) => {
  if (order.shipping.shipmentId) {
    return order.shipping;
  }

  const payload = {
    order_id: order.orderNumber,
    order_date: order.createdAt,
    pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION,
    billing_customer_name: order.shippingAddress.fullName,
    billing_last_name: "",
    billing_address: order.shippingAddress.address,
    billing_city: order.shippingAddress.city,
    billing_pincode: order.shippingAddress.pincode,
    billing_state: order.shippingAddress.state,
    billing_country: "India",
    billing_email: order.user.email,
    billing_phone: order.shippingAddress.phone,
    shipping_is_billing: true,
    order_items: order.items.map((item) => ({
      name: item.name,
      sku: item.sku,
      units: item.quantity,
      selling_price: item.price,
    })),
    payment_method: order.payment.provider === "cod" ? "COD" : "Prepaid",
    sub_total: order.pricing.subtotal,
    shipping_charges: order.pricing.shippingCost,
    total_discount: order.pricing.discount,
    length: order.shipping.package.length,
    breadth: order.shipping.package.breadth,
    height: order.shipping.package.height,
    weight: order.shipping.package.weight,
  };

  const { data } = await shiprocket.post("/orders/create/adhoc", payload);
  const shipment = data.payload ?? data;

  order.shipping.provider = "shiprocket";
  order.shipping.status = "Shipment Created";
  order.shipping.shiprocketOrderId = shipment.order_id;
  order.shipping.shipmentId = shipment.shipment_id;
  order.shipping.awbCode = shipment.awb_code;
  order.shipping.courier = shipment.courier_name;
  order.shipping.trackingUrl = `https://shiprocket.co/tracking/${shipment.awb_code}`;
  order.shipping.estimatedDelivery = shipment.estimated_delivery_days ?? null;
  order.shipping.courierId = shipment.courier_company_id;

  await order.save();
  return shipment;
};

export const schedulePickup = async (shipmentId) => {
  const { data } = await shiprocket.post("/courier/generate/pickup", {
    shipment_id: [shipmentId],
  });

  return data;
};

export const trackShipment = async (awbCode) => {
  const { data } = await shiprocket.get(`/courier/track/awb/${awbCode}`);

  return data;
};

export const cancelShipment = async (shipmentId) => {
  const { data } = await shiprocket.post("/orders/cancel", {
    ids: [shipmentId],
  });

  return data;
};

function calculatePackage(products) {
  let totalWeight = 0;

  let maxLength = 0;
  let maxBreadth = 0;
  let totalHeight = 0;

  for (const item of products) {
    if (!item.product.shipping) {
      throw new Error(`${item.product.name} is missing shipping dimensions`);
    }
    const shipping = item.product.shipping;

    const qty = item.quantity;

    totalWeight += shipping.weight * qty;

    maxLength = Math.max(maxLength, shipping.length);

    maxBreadth = Math.max(maxBreadth, shipping.breadth);

    totalHeight += shipping.height * qty;
  }

  return {
    weight: Number(totalWeight.toFixed(2)),
    length: maxLength,
    breadth: maxBreadth,
    height: totalHeight,
  };
}

export const calculateShippingRates = async ({
  products,
  destinationPincode,
}) => {
  for (const item of products) {
    if (!item.product.shipping?.isShippable) {
      throw new Error(`${item.product.name} requires quotation`);
    }
  }
  const pkg = calculatePackage(products);

  const { data } = await shiprocket.get("/courier/serviceability", {
    params: {
      pickup_postcode: process.env.STORE_PINCODE,

      delivery_postcode: destinationPincode,

      cod: 0,

      weight: pkg.weight,

      length: pkg.length,

      breadth: pkg.breadth,

      height: pkg.height,
    },
  });

  if (!data.data?.available_courier_companies?.length) {
    throw new Error("Delivery is not available for this pincode");
  }

  const courier = data.data.available_courier_companies.reduce(
    (best, current) => (current.rate < best.rate ? current : best),
  );

  return {
    shippingCost: courier.rate,

    courier: courier.courier_name,

    courierId: courier.courier_company_id,

    estimatedDelivery: courier.estimated_delivery_days,

    package: pkg,
  };
};

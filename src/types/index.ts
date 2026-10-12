export interface ProductVariant {
  id: string;
  label: string;
  priceDelta?: number;
}

export interface ProductSpec {
  label: string;
  value: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  categorySlug: string;
  price: number;
  compareAtPrice?: number;
  currency: string;
  images: string[];
  shortDescription: string;
  description: string;
  specs: ProductSpec[];
  rating: number;
  reviewCount: number;
  stock: number;
  sku: string;
  tags: string[];
  featured: boolean;
  isNew: boolean;
  isBestseller: boolean;
  variants?: ProductVariant[];
  status: "active" | "draft" | "archived";
  createdAt: string;
}

export interface Review {
  id: string;
  productId: string;
  author: string;
  rating: number;
  title: string;
  comment: string;
  date: string;
  verified: boolean;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string;
  image: string;
  featured: boolean;
}

export interface CarouselSlide {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  ctaText: string;
  ctaLink: string;
  order: number;
  active: boolean;
}

export interface Address {
  fullName: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
}

export interface CartLine {
  productId: string;
  variantId?: string;
  quantity: number;
}

export type OrderStatus =
  | "pending"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export interface OrderStatusEvent {
  status: OrderStatus;
  date: string;
  note: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  image: string;
  variantLabel?: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  email: string;
  customerName: string;
  items: OrderItem[];
  shippingAddress: Address;
  shippingMethod: "standard" | "express";
  paymentMethod: "card" | "paypal" | "cod";
  subtotal: number;
  shippingCost: number;
  tax: number;
  discount: number;
  total: number;
  couponCode?: string;
  status: OrderStatus;
  statusHistory: OrderStatusEvent[];
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: "customer" | "admin";
  addresses: Address[];
  createdAt: string;
}

export interface StoreSettings {
  storeName: string;
  tagline: string;
  currency: string;
  currencySymbol: string;
  taxRatePercent: number;
  flatShippingRate: number;
  expressShippingRate: number;
  freeShippingThreshold: number;
  contactEmail: string;
  contactPhone: string;
  address: string;
  socialLinks: { platform: string; url: string }[];
}

export interface Coupon {
  code: string;
  type: "percent" | "fixed";
  value: number;
  active: boolean;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  cost: number;
  markup: number;
  price: number;
  unit: string;
  category: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  address: string;
  projects: Project[];
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  customerId: string;
  status: "active" | "completed" | "on-hold";
  startDate: string;
  endDate?: string;
}

export interface Vendor {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  specialty: string;
  status: "active" | "inactive";
  rating: number;
  createdAt: string;
}

export interface EstimateLineItem {
  id: string;
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  markup: number;
  total: number;
}

export interface Estimate {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  projectId?: string;
  projectName?: string;
  status: "draft" | "pending" | "approved" | "sent" | "closed";
  lineItems: EstimateLineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  notes?: string;
  createdAt: string;
  validUntil: string;
}

export interface JobOrder {
  id: string;
  number: string;
  estimateId: string;
  customerId: string;
  customerName: string;
  projectId: string;
  projectName: string;
  status: "active" | "in-progress" | "completed" | "on-hold";
  lineItems: EstimateLineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  invoicedAmount: number;
  remainingAmount: number;
  startDate: string;
  completionDate?: string;
  createdAt: string;
}

export interface PurchaseOrder {
  id: string;
  number: string;
  jobOrderId: string;
  jobOrderNumber: string;
  vendorId: string;
  vendorName: string;
  projectId: string;
  projectName: string;
  customerId: string;
  customerName: string;
  status: "draft" | "sent" | "acknowledged" | "in-progress" | "completed" | "cancelled";
  lineItems: EstimateLineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  notes?: string;
  dueDate: string;
  createdAt: string;
}

export interface Invoice {
  id: string;
  number: string;
  jobOrderId?: string;
  jobOrderNumber?: string;
  estimateId?: string;
  customerId: string;
  customerName: string;
  projectName?: string;
  status: "draft" | "sent" | "paid" | "overdue";
  lineItems: EstimateLineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  dueDate: string;
  paidDate?: string;
  createdAt: string;
}

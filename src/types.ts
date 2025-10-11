export interface ProductDimensions {
  w_cm: number;
  h_cm: number;
  d_cm: number;
}

export interface ProductEdition {
  current: number;
  of: number;
}

export type ProductSpecs = Record<string, string>;

export interface Product {
  id: string;
  title: string;
  artist?: string;
  year?: number;
  price: number;
  currency: string;
  unit: string;
  stock: number;
  sku?: string;
  dimensions?: ProductDimensions;
  materials?: string;
  edition?: ProductEdition;
  images: string[];
  description?: string;
  specs?: ProductSpecs;
}

export interface CartStorageItem {
  productId: string;
  quantity: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

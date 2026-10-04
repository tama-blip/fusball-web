const PRODUCTS = [
  {
    id: 1,
    name: "Indonesia Fantasy 01",
    category: "National Fantasy",
    price: 185000,
    status: "PO OPEN",
    image: "assets/images/jersey-indonesia.png",
    description: "Fantasy jersey bertema Indonesia dengan visual original Fusball.id. Cocok untuk pemakaian casual maupun koleksi.",
    sizes: ["S","M","L","XL","XXL"]
  },
  {
    id: 2,
    name: "Argentina Fantasy 01",
    category: "National Fantasy",
    price: 185000,
    status: "PO OPEN",
    image: "assets/images/jersey-argentina.png",
    description: "Fantasy football jersey dengan nuansa Argentina dan treatment visual yang dibuat untuk identitas Fusball.id.",
    sizes: ["S","M","L","XL","XXL"]
  },
  {
    id: 3,
    name: "European Club Fantasy",
    category: "Club Fantasy",
    price: 195000,
    status: "PO OPEN",
    image: "assets/images/jersey-europe.png",
    description: "Fantasy jersey terinspirasi atmosfer football club Eropa dengan desain original Fusball.id.",
    sizes: ["S","M","L","XL","XXL"]
  },
  {
    id: 4,
    name: "Japan Fantasy 01",
    category: "Country Fantasy",
    price: 185000,
    status: "PO OPEN",
    image: "assets/images/jersey-japan.png",
    description: "Country fantasy collection dengan pendekatan visual modern dan clean.",
    sizes: ["S","M","L","XL","XXL"]
  },
  {
    id: 5,
    name: "Brazil Fantasy 01",
    category: "Country Fantasy",
    price: 185000,
    status: "COMING SOON",
    image: "assets/images/jersey-brazil.png",
    description: "Country fantasy collection untuk Brazil-inspired release.",
    sizes: ["S","M","L","XL","XXL"]
  },
  {
    id: 6,
    name: "Special Collection 01",
    category: "Special Collection",
    price: 210000,
    status: "PO OPEN",
    image: "assets/images/jersey-special.png",
    description: "Special drop dengan treatment terbatas untuk kolektor dan football culture enthusiast.",
    sizes: ["S","M","L","XL","XXL"]
  }
];

let PRODUCT_OVERRIDES = null;
try {
  PRODUCT_OVERRIDES = JSON.parse(localStorage.getItem("fusballProductsOverride") || "null");
} catch {
  localStorage.removeItem("fusballProductsOverride");
}

if (Array.isArray(PRODUCT_OVERRIDES)) {
  for (const override of PRODUCT_OVERRIDES) {
    const target = PRODUCTS.find(p => p.id === Number(override?.id));
    if (target) Object.assign(target, {
      price: override.price ?? target.price,
      status: override.status ?? target.status
    });
  }
}

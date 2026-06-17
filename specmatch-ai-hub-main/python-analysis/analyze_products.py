import json

products = [
    {"name": "MacBook Pro M3", "category": "Laptop", "price": 3199},
    {"name": "Dell XPS 15", "category": "Laptop", "price": 2499},
    {"name": "Galaxy S26 Ultra", "category": "Smartphone", "price": 1399},
    {"name": "iPhone 17 Pro Max", "category": "Smartphone", "price": 1199},
    {"name": "Apple Watch Series 11", "category": "Smartwatch", "price": 499}
]

total_products = len(products)

average_price = sum(
    p["price"] for p in products
) / total_products

highest_price = max(
    products,
    key=lambda p: p["price"]
)

report = {
    "total_products": total_products,
    "average_price": round(average_price, 2),
    "most_expensive_product": highest_price["name"],
    "highest_price": highest_price["price"]
}

print(json.dumps(report, indent=2))
with open("analysis_report.json", "w") as f:
    json.dump(report, f, indent=2)

print("Report generated.")
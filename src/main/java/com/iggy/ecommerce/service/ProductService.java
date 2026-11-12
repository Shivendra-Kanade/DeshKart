package com.iggy.ecommerce.service;

import com.iggy.ecommerce.entity.Product;
import com.iggy.ecommerce.exception.ResourceNotFoundException;
import com.iggy.ecommerce.repository.ProductRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class ProductService {

    private ProductRepository productRepository;

    public ProductService(ProductRepository productRepository) {
        this.productRepository = productRepository;
    }

    public List<Product> getAllProducts() {
        return productRepository.findAll();
    }

    public Optional<Product> getProductById(Long id) {
        return productRepository.findById(id);
    }

    public List<Product> getProductsByCategory(String category) {
        return productRepository.findByCategory(category);
    }

    public Product createProduct(Product product) {
        return productRepository.save(product);
    }

    public Product updateProduct(Long id, Product product) {
        Product existing = productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found"));
        existing.setName(product.getName());
        existing.setDescription(product.getDescription());
        existing.setPrice(product.getPrice());
        existing.setStock(product.getStock());
        existing.setCategory(product.getCategory());
        existing.setImageUrl(product.getImageUrl());
        return productRepository.save(existing);
    }

    public void deleteProduct(Long id) {
        productRepository.deleteById(id);
    }

    @Transactional
    public String removeDuplicateProducts() {
        List<Product> allProducts = productRepository.findAll();
        int duplicatesRemoved = 0;

        // Group by name and category
        java.util.Map<Object, List<Product>> grouped = allProducts.stream()
                .collect(Collectors.groupingBy(p -> p.getName() + "|" + (p.getCategory() != null ? p.getCategory() : "")));

        for (java.util.Map.Entry<Object, List<Product>> entry : grouped.entrySet()) {
            List<Product> group = entry.getValue();
            if (group.size() > 1) {
                // Keep the first one (lowest ID), delete the rest
                Product toKeep = group.stream().min((p1, p2) -> p1.getId().compareTo(p2.getId())).orElse(group.get(0));
                for (Product p : group) {
                    if (!p.getId().equals(toKeep.getId())) {
                        productRepository.delete(p);
                        duplicatesRemoved++;
                    }
                }
            }
        }

        return "Removed " + duplicatesRemoved + " duplicate products";
    }
}
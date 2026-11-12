package com.iggy.ecommerce.repository;

import com.iggy.ecommerce.entity.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ProductRepository extends JpaRepository<Product, Long> {
        List<Product> findByCategory(String category);

        @Query("SELECT p FROM Product p WHERE p.name = :name AND p.category = :category ORDER BY p.id")
        List<Product> findByNameAndCategoryOrderById(@Param("name") String name, @Param("category") String category);
}

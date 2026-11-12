package com.iggy.ecommerce.controller;

import com.iggy.ecommerce.entity.Order;
import com.iggy.ecommerce.entity.OrderStatus;
import com.iggy.ecommerce.service.OrderService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/orders")
public class OrderController {

    private OrderService orderService;
    public OrderController(OrderService orderService){
        this.orderService = orderService;
    }

    @GetMapping
    public List<Order> getAllOrders(){ return orderService.getAllOrders();}

    @PostMapping("/{userId}")
    public Order placeOrder(@PathVariable Long userId){ return orderService.placeOrder(userId);}

    @GetMapping("/user/{userId}")
    public List<Order> getAllOrderForUser(@PathVariable Long userId){ return orderService.getOrdersByUserId(userId);}

    @GetMapping("/{orderId}")
    public Order getSingleOrder(@PathVariable Long orderId){ return orderService.getOrderById(orderId);}

    @PutMapping("/{orderId}/status")
    public Order updateOrderStatus(@PathVariable Long orderId, @RequestBody Map<String, String> request){
        OrderStatus status = OrderStatus.valueOf(request.get("status"));
        return orderService.updateOrderStatus(orderId, status);
    }


}

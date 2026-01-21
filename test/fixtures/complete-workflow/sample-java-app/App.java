package com.example;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;

/**
 * Simple Java HTTP server for E2E workflow testing.
 * Self-contained with no external dependencies.
 */
public class App {
    private static final int PORT = 8080;

    public static void main(String[] args) throws IOException {
        // Health check mode for container health checks
        if (args.length > 0 && "health".equals(args[0])) {
            System.out.println("Health check: OK");
            System.exit(0);
            return;
        }

        HttpServer server = HttpServer.create(new InetSocketAddress(PORT), 0);
        
        // Root endpoint
        server.createContext("/", exchange -> {
            String response = "{\"message\": \"Hello from Java!\", \"version\": \"1.0.0\"}";
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length());
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(response.getBytes());
            }
        });
        
        // Health endpoint
        server.createContext("/health", exchange -> {
            String response = "{\"status\": \"healthy\"}";
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length());
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(response.getBytes());
            }
        });

        // Ready endpoint
        server.createContext("/ready", exchange -> {
            String response = "{\"ready\": true}";
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length());
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(response.getBytes());
            }
        });

        server.setExecutor(null);
        server.start();
        System.out.println("Java server running on port " + PORT);
    }
}

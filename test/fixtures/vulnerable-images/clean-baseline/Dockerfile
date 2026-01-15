# Test Case: Clean .NET Image (Control/Baseline)
# Expected: Critical 0, High 0, Medium minimal (OS packages only)
# Base image: mcr.microsoft.com/dotnet/runtime:8.0 - Microsoft official, up-to-date
# This is a CLEAN image used to verify scanner correctly identifies secure images
FROM mcr.microsoft.com/dotnet/runtime:8.0-alpine

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S dotnetuser && \
    adduser -S dotnetuser -u 1001

# Switch to non-root user
USER dotnetuser

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD echo "healthy" || exit 1

# This is a placeholder - the actual .dll would be copied in a real app
# For testing, we just verify the base image is clean
CMD ["echo", "Clean image test"]

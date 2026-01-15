# Test Case: Python with Known CVEs
# Expected: Critical 5-10, High 20-30, Medium 35-50
# Base image: python:3.7.9 has known CVEs in Python core
# ⚠️ INTENTIONALLY VULNERABLE - FOR TESTING ONLY
FROM python:3.7.9

WORKDIR /app

# Copy requirements with vulnerable packages
COPY requirements.txt .

# Install dependencies (includes vulnerable packages)
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY app.py ./

# Expose port
EXPOSE 5000

# Start application
CMD ["python", "app.py"]

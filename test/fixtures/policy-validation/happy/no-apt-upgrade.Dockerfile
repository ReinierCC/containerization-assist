# Test: avoid-apt-upgrade (PASS)
# Uses apt-get install without upgrade
FROM mcr.microsoft.com/dotnet/aspnet:8.0

WORKDIR /app

RUN apt-get update && \
    apt-get install -y curl wget && \
    rm -rf /var/lib/apt/lists/*

COPY . .

USER app
EXPOSE 8080

CMD ["dotnet", "MyApp.dll"]

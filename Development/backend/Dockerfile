# Base image for running the application
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
EXPOSE 8080
EXPOSE 8081

# SDK image for building the application
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy solution file and project files for restoring dependencies
COPY ["GP35.SRIS.sln", "./"]
COPY ["Hosts/GP35.SRIS/GP35.SRIS.csproj", "Hosts/GP35.SRIS/"]
COPY ["Src/Application/GP35.SRIS.Application/GP35.SRIS.Application.csproj", "Src/Application/GP35.SRIS.Application/"]
COPY ["Src/Application/GP35.SRIS.Application.Contracts/GP35.SRIS.Application.Contracts.csproj", "Src/Application/GP35.SRIS.Application.Contracts/"]
COPY ["Src/Domain/GP35.SRIS.Domain/GP35.SRIS.Domain.csproj", "Src/Domain/GP35.SRIS.Domain/"]
COPY ["Src/Domain/GP35.SRIS.Domain.Shared/GP35.SRIS.Domain.Shared.csproj", "Src/Domain/GP35.SRIS.Domain.Shared/"]
COPY ["Src/Domain/GP35.SRIS.Domain.SqlServer/GP35.SRIS.Domain.SqlServer.csproj", "Src/Domain/GP35.SRIS.Domain.SqlServer/"]
COPY ["Src/Library/GP35.SRIS.Cache/GP35.SRIS.Cache.csproj", "Src/Library/GP35.SRIS.Cache/"]
COPY ["Src/Library/GP35.SRIS.HostBase/GP35.SRIS.HostBase.csproj", "Src/Library/GP35.SRIS.HostBase/"]
COPY ["Src/Library/GP35.SRIS.Lib/GP35.SRIS.Lib.csproj", "Src/Library/GP35.SRIS.Lib/"]
COPY ["Src/Library/GP35.SRIS.Storage/GP35.SRIS.Storage.csproj", "Src/Library/GP35.SRIS.Storage/"]
COPY ["Src/Library/GP35.SRIS.Storage.Minio/GP35.SRIS.Storage.Minio.csproj", "Src/Library/GP35.SRIS.Storage.Minio/"]
COPY ["tools/GP35.SRIS.DbMigrator/GP35.SRIS.DbMigrator.csproj", "tools/GP35.SRIS.DbMigrator/"]

# Restore dependencies
RUN dotnet restore "GP35.SRIS.sln"

# Copy the rest of the source code
COPY . .

# Build the Web API host project
WORKDIR "/src/Hosts/GP35.SRIS"
RUN dotnet build "GP35.SRIS.csproj" -c Release -o /app/build

# Publish stage
FROM build AS publish
RUN dotnet publish "GP35.SRIS.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Final runtime image
FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "GP35.SRIS.dll"]

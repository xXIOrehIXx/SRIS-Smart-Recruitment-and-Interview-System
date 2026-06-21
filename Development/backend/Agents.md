# SRIS

## Project Overview

**SRIS backend**

ASP.NET Core 10 Web API for managing:

* 
* 
* 

### Technology Stack

* .NET 10
* SQLSERVER
* Serilog
* AutoMapper
* Newtonsoft.Json

---

## Solution Structure

```text
GP35.SRIS.sln
│
├── GP35.SRIS/                     # Web host
│   ├── Program.cs
│   ├── Startup.cs
│   └── Controllers/
│
├── GP35.SRIS.HostBase/            # Shared hosting
│   ├── Middleware
│   ├── DI Extensions
│   └── Configuration
│
├── GP35.SRIS.Application/         # Business logic services
│
├── GP35.SRIS.Application.Contracts/
│   ├── DTOs
│   ├── Service Interfaces
│   └── Contracts
│
├── GP35.SRIS.Domain/              # Entity models
│
├── GP35.SRIS.Domain.Shared/       # Shared domain components
│   ├── Context
│   ├── Constants
│   ├── Exceptions
│   ├── Enums
│   └── Extensions
│
├── GP35.SRIS.Domain.SqlServer/        # SqlServer infrastructure
│   ├── Repositories
│   ├── UnitOfWork
│   └── DB Configuration
│
├── GP35.SRIS.Lib/                 # External integrations
│   ├── Email
│   ├── HTTP
│
├── GP35.SRIS.Storage/             # Storage abstractions
│
├── GP35.SRIS.Storage.Minio/       # MinIO implementation
│
└── GP35.SRIS.Cache/               # Caching extensions
```

---

## Layer Dependencies

```text
Web Host
    │
    ▼
HostBase
    │
    ▼
Application ──────────────► Application.Contracts
    │
    ├──────────────► Domain
    │                   │
    │                   ▼
    └──────────────► Domain.Shared

Domain
    │
    ▼
Domain.SqlServer

Lib ─► Storage ─► Storage.Minio
```

### Dependency Rules

* **Domain** projects must NOT depend on Application or Infrastructure layers.
* **Application** depends on:
  * Domain
  * Domain.Shared
  * Application.Contracts
* **HostBase** depends on:
  * Application
  * Lib
  * Storage
* **Web Host** depends only on:
  * HostBase
---

## Key Patterns

### Authentication & User Context

The system uses **Token-based Authentication**.

`AuthMiddleware`:

1. Reads token from request header.
2. Validates the token.
3. Populates `IContextData`.

```csharp
services.AddScoped<IContextData, ContextData>();
```

#### Components

* `AuthMiddleware`

  * Validates token
  * Sets `IContextData`

* Services

  * Inject `IContextData`
  * Access current user information

---

### Service Pattern

All services inherit from `BaseService<T>` and resolve dependencies through `IServiceProvider`.

```csharp
public class RequestService : BaseService<RequestService>, IRequestService
{
    private readonly IRequestRepo _requestRepo;

    public RequestService(IServiceProvider serviceProvider)
        : base(serviceProvider)
    {
        _requestRepo = serviceProvider.GetRequiredService<IRequestRepo>();
    }
}
```

---

### Repository & Unit of Work

#### Repositories

Located in:

```text
Domain.SqlServer/Repos/
```

#### Unit of Work

`BusinessUow` manages transactions across multiple repositories.

#### Database Configuration

`BusinessDbConfig` contains the database connection string and related settings.

---

### JSON Serialization

#### Default API Responses

Uses:

```csharp
System.Text.Json
```

Features:

* camelCase naming
* .NET 6 default configuration

#### Error Responses

Uses:

```csharp
Newtonsoft.Json
```

through:

```csharp
ErrorObjectCommon.ToString()
```

> Both serializers coexist. Verify which serializer is used in a given execution path.

---

## Dependency Injection

All registrations are centralized in:

```text
HostBase/Extensions/ServiceCollectionExtensions.cs
```

### ConfigureCommonConfig

Registers:

* Application configuration
* Redis configuration

### ConfigureCommonServices

Registers shared services:

* HttpService
* Email Service
* Slack Service
* Cache
* ContextData

### AddBusinessRepos

Registers all SQLServer repository implementations.

### AddBusinessServices

Registers all application services.

### AddAutoMapper

Registers AutoMapper profiles.

---

## Exception Handling

### ErrorObjectCommon

Standardized error response structure:

```csharp
{
    ErrorCode,
    DevMsg,
    UserMsg,
    TraceId,
    ValidationFailures
}
```

### Global Exception Middleware

```csharp
ConfigureExceptionHandler()
```

### Model Validation

Custom validation response via:

```csharp
[ModelValidation]
```

---

## Permissions

### Permission Constants

```csharp
PermissionConstants
```

Contains all permission identifiers.

### Controller Authorization

```csharp
[WithPermission(PermissionConstants.Xxx)]
```

### Enforcement

Handled by:

```csharp
PermissionMiddleware
```

after authentication succeeds.

---

## Coding Conventions

### Naming

* PascalCase for all C# identifiers.
* Database column names follow the same convention.

### Async Programming

Use `async/await` for all I/O-bound operations.

### Logging

Serilog with structured logging.

Preferred pattern:

```csharp
_logger.Here()
```

for caller context information.

### Configuration

Use strongly typed configuration classes:

```csharp
InitConfig<T>()
```

where configuration types inherit from:

```csharp
DefaultConfig
```

### Controllers

```csharp
[ApiController]
[Route("api/[controller]s")]
```

or

```csharp
[Route("[controller]s")]
```

### Swagger

* Swashbuckle
* XML comments enabled

---

## External Dependencies

| Service     | Purpose                                |
| ----------- | -------------------------------------- |
| SqlServer       | Primary data store                     |
| MinIO       | Document and certificate storage       |

---

## Build & Run

### Restore

```bash
dotnet restore
```

### Build

```bash
dotnet build
```

### Run

Requires:

* SqlServer
* MinIO

```bash
dotnet run --project GP35.SRIS

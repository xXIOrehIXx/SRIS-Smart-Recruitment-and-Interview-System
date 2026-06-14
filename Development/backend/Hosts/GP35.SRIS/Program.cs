using GP35.SRIS.HostBase.Extensions;

var builder = WebApplication.CreateBuilder(args);

var services = builder.Services;
var configuration = builder.Configuration;

services.ConfigureCommonServices();
services.AddBusinessServices();
services.AddBusinessRepos(configuration);
services.AddAutoMapper();
services.AddControllers();      
services.AddSwaggerGen(c =>
{
  c.SwaggerDoc("v1", new() { Title = "GP35.SRIS API", Version = "v1" });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}

app.UseSwagger();
app.UseSwaggerUI((c) =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "GP35.SRIS API V1");
});

app.UseHttpsRedirection();
app.UseStaticFiles();

app.UseRouting();

app.UseAuthorization();

app.MapControllers(); 

app.Run();

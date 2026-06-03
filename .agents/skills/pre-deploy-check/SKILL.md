---
name: pre-deploy-check
description: Checklist rápido pre-entrega. Úsala cuando el usuario pide revisar código antes de subir a producción o entregarlo a un cliente.
---

# Pre-Deploy Check

Eres un revisor de código experimentado haciendo una pasada rápida antes de entregar a producción. Tu objetivo es detectar los descuidos típicos, no hacer una auditoría exhaustiva.

## Instrucciones

1. Analiza el código del proyecto o la carpeta que te indiquen.
2. Si el proyecto tiene más de 200 archivos y no te han acotado una carpeta, pregunta antes de continuar: "El proyecto es grande, ¿reviso todo o una carpeta concreta como `src/api`?"
3. Por cada categoría, asigna estado y lista hallazgos con ubicación exacta (`archivo:línea`).
4. Si una categoría no tiene problemas, escribe "Sin problemas detectados" y sigue. Sin relleno.
5. Sé directo. No expliques qué es SQLi ni por qué los secretos son malos — el usuario ya lo sabe.

## Formato de salida

```
## [EMOJI] Nombre de categoría

- archivo.ts:42 — descripción concisa del problema
- archivo.ts:87 — otro problema
```

Estados:
- 🔴 **Arreglar** — no entregar con esto
- 🟡 **Revisar** — no es urgente pero hay que decidir
- 🟢 **OK** — sin problemas detectados

Termina siempre con este bloque:

```
---
## Resumen
🔴 X a arreglar
🟡 Y a revisar  
🟢 Z OK
```

---

## Categorías

### 1. Secretos y configuración
- Claves API, tokens o contraseñas hardcodeadas en código fuente
- Archivos `.env` commiteados al repositorio
- URLs de entorno local en código (`localhost`, `127.0.0.1`, `staging.`, `dev.`)
- Flags de debug activos (`DEBUG=true`, `isDev = true` sin condicional de entorno)

### 2. Autenticación y autorización
- Endpoints o rutas sin middleware de autenticación
- Falta de comprobación de ownership: ¿el código verifica que el recurso pedido pertenece al usuario que lo pide?
- Tokens sensibles almacenados en `localStorage` (debería ser cookie HttpOnly)
- Sin expiración de sesión o token

### 3. Validación de entrada
- Input de formularios o parámetros de API validados solo en cliente (no cuenta — debe validarse en servidor)
- Confianza en tipos de TypeScript como validación real en runtime (no lo son)
- Input del usuario usado directamente en queries, HTML o rutas de archivo sin sanitizar

### 4. Manejo de errores y logs
- `try/catch` que captura el error y no hace nada (`catch(e) {}` o `catch { }`)
- Mensajes de error que devuelven stack traces o detalles internos al cliente
- `console.log`, `print`, `Debug.WriteLine` con datos de usuario o datos sensibles
- Operaciones críticas (pagos, cambios de contraseña, borrados) sin logging

### 5. Base de datos
- Queries construidas concatenando strings con input del usuario (riesgo SQLi)
- Query dentro de un bucle sobre resultados de otra query (N+1)
- Operaciones de escritura críticas sin transacción (pagos, actualizaciones de saldo, stocks)
- Columnas usadas en `WHERE` o `JOIN` frecuente sin índice evidente

### 6. Código muerto y debug olvidado
- `console.log` o prints de debugging sin limpiar
- Código comentado con lógica real (no comentarios explicativos)
- `TODO` o `FIXME` en funcionalidad crítica o de seguridad
- Endpoints, rutas o funciones que ya no se usan pero siguen expuestos

### 7. Dependencias
- Paquetes con vulnerabilidades conocidas — si hay acceso a terminal, ejecuta `npm audit` o `dotnet list package --vulnerable`
- Versiones con `*` o rangos muy amplios en el manifest
- Paquetes de desarrollo (`devDependencies`) incluidos en el build de producción

### 8. Listo para producción
- Variables de entorno usadas en código sin documentar ni tener valor por defecto seguro
- CORS configurado como `*` en una API que no es pública
- Endpoints de login, registro o reset sin rate limiting
- Sin healthcheck o endpoint de estado (`/health`, `/ping`)
- Modo debug del framework activo (`app.UseDeveloperExceptionPage()` en .NET, `DEBUG=True` en Django, etc.)

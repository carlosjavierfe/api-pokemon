---
name: pokemon-project
description: Convenciones generales para el juego Pokemon y su despliegue en Cloudflare.
applyTo: "**/*"
---

# Convenciones del proyecto

- Lee `MEMORIA_PROYECTO.md` antes de cambiar arquitectura o alcance.
- Prioriza el flujo jugable completo sobre funcionalidades secundarias.
- Mantén la respuesta correcta y el puntaje en el backend.
- El frontend consume el backend propio, no PokéAPI directamente.
- Nunca escribas secretos en el repositorio.
- Usa TypeScript, nombres descriptivos y cambios pequeños.
- Ejecuta la validación más específica disponible después de cada cambio.
- Documenta decisiones relevantes en `DECISIONS.md` y uso de Copilot en `AI_USAGE.md`.
- Antes de editar, crear, ejecutar, instalar, usar Git o desplegar, explica la acción y pide autorización explícita al usuario. Espera su respuesta antes de continuar.
# Enrutamiento obligatorio del proyecto

Para cada solicitud de desarrollo en este repositorio:

1. El asistente principal debe enrutar primero la tarea al agente `orchestrator`.
2. `orchestrator` debe leer `MEMORIA_PROYECTO.md`, dividir la tarea y delegar:
   - backend, Worker, D1 o PokéAPI a `backend`;
   - React, CSS o interacción a `frontend`;
   - pruebas finales, seguridad, documentación de release o despliegue a `qa-release`.
3. Ningún agente debe editar, ejecutar, instalar, usar Git o desplegar sin autorización explícita del usuario.
4. Después de cada delegación, actualizar `AI_USAGE.md` con evidencia breve: agente, tarea, resultado, validación y estado.
5. No copiar prompts completos ni conversaciones; mantener el registro entre 3 y 8 líneas por delegación.
6. El asistente principal no debe implementar directamente una tarea especializada mientras exista un agente adecuado.
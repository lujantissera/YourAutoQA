# Configurar Jira para desarrollo

> **Para quién es:** quien desarrolla YouAutoQA y necesita un Jira donde probar.
> **Importante:** el token de API que se crea aquí es un **andamio de desarrollo** (decisiones D-43 y
> D-45). Los usuarios finales **no** crearán tokens: cuando exista el login (Fase 5), iniciarán sesión
> con Atlassian y aceptarán los permisos. Esta guía no es el manual de usuario.

## Qué conseguirás

Un sitio de Jira con un proyecto y unas historias de prueba, y un **token de API con permisos
mínimos** (solo lectura) para que el backend lea historias a través de la API REST de Jira.

**¿Por qué REST y no el servidor MCP de Atlassian?** Se probó el MCP con token de API: la conexión
funciona, pero todas las herramientas de Jira devuelven `401 Failed to fetch accessible products`
(decisión D-45). La API REST con un token de un solo permiso es más simple y cumple lo mismo.

## 1. El sitio y el proyecto de Jira

1. Crea una cuenta en Atlassian y un sitio de Jira (Atlassian puede activar pruebas gratuitas de
   varios productos; ver el apartado de facturación).
2. En el proyecto, abre **Configuración del espacio → Detalles** y pon:
   - **Nombre:** `Your Auto QA`
   - **Clave:** `YAQ` (las historias se llamarán `YAQ-1`, `YAQ-2`...).
3. En **Tipos de actividad**, comprueba que existe **Historia**; si no, añádela.
4. (Opcional) Cambia la URL del sitio en **admin.atlassian.com → Aplicaciones → URL de aplicaciones →
   Actualizar URL**. Se puede cambiar hasta 3 veces. Hazlo **antes** de configurar nada contra ella.

**Facturación.** En **admin.atlassian.com → Billing and subscriptions** comprueba qué productos están
en plan de pago o en prueba. YouAutoQA solo necesita Jira; cancela los demás (Confluence, Service
Management) y revisa la fecha de fin de las pruebas para evitar cargos.

## 2. Historias de prueba

Crea estas historias, **en este orden**, para que sus claves sean `YAQ-1`, `YAQ-2` y `YAQ-3`:

| Clave     | Para probar                          | Contenido                                                                  |
| --------- | ------------------------------------ | -------------------------------------------------------------------------- |
| `YAQ-1`   | Caso normal, con criterios (US-03.1) | Historia de login en saucedemo, con un apartado `Criterios de aceptación:` |
| `YAQ-2`   | Sin criterios (US-03.3)              | Historia de añadir la mochila al carrito, sin ese apartado                 |
| `YAQ-3`   | Historia ambigua                     | Baja de cuenta: la web de pruebas no tiene esa función                     |
| `YAQ-999` | Error 404 (US-04.1)                  | **No se crea**: debe no existir                                            |

Las credenciales `standard_user` / `secret_sauce` son las públicas de la web de demostración de
saucedemo; no hay secretos reales en las historias.

## 3. Crear el token con permisos mínimos

No hace falta activar nada en la administración de Atlassian (la opción de "autenticación por token
de API" del servidor MCP solo afecta al MCP).

1. Ve a **id.atlassian.com/manage-profile/security/api-tokens** y elige
   **Crear token de API con ámbitos** (la opción sin ámbitos da acceso a todo: no la uses).
2. **Nombre:** `yourautoqa-rest`. **Caducidad:** la que prefieras (un mes evita repetirlo pronto; hay
   que renovarlo al caducar).
3. **Aplicación:** **Jira**.
4. **Permisos:** marca **solo** `read:jira-work`.
5. Revisa el resumen (nombre, aplicación, caducidad y ese único permiso) y pulsa **Crear token**.
6. **Cópialo en ese momento**: solo se muestra una vez.

## 4. Guardar la configuración

Añade al archivo `.env` de la raíz del repositorio (está ignorado por git), sin comillas:

```
ATLASSIAN_EMAIL=correo-con-el-que-te-registraste-en-atlassian
ATLASSIAN_API_TOKEN=el-token
ATLASSIAN_CLOUD_ID=uuid-de-tu-sitio
```

El `cloudId` identifica tu sitio y no es secreto. Se obtiene abriendo en el navegador
`https://TU-SITIO.atlassian.net/_edge/tenant_info`, que devuelve `{"cloudId":"..."}`.

Opcional: `JIRA_TIMEOUT_MS` (tiempo máximo de espera a Jira en milisegundos; por defecto 10000).

Comprueba que git ignora el archivo:

```bash
git check-ignore -v .env
```

## 5. Comprobar que funciona

Desde `backend/`:

```bash
npm run try-agent -- YAQ-999
```

Debe responder `No se puede continuar: Issue YAQ-999 was not found, or you cannot view it.` y
terminar **sin llamar al LLM ni a Docker** (no cuesta nada).

Para el flujo completo con la historia real (necesita Docker Desktop encendido y gasta céntimos de
OpenAI):

```bash
npm run try-agent -- YAQ-1
```

## Qué no hacer

- No pegues el token en el chat, en issues, en el código ni en capturas de pantalla.
- No crees tokens con permisos de escritura, borrado o administración: el backend solo lee.
- No reutilices este token fuera de desarrollo: en producción se usará el login de cada usuario o
  una cuenta de servicio creada por el administrador de la empresa.

## Problemas frecuentes

| Síntoma                                                  | Causa probable                                                                                     |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `Missing required environment variables: ...`            | Falta alguna de `ATLASSIAN_EMAIL`, `ATLASSIAN_API_TOKEN` o `ATLASSIAN_CLOUD_ID` en el `.env`       |
| `ATLASSIAN_CLOUD_ID must be a UUID`                      | El `cloudId` está mal copiado: debe tener el formato `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`        |
| `Jira rejected the credentials or you do not have ...`   | El token caducó o se revocó, el correo no es el de su propietario, o se creó sin `read:jira-work`   |
| `Issue YAQ-1 was not found, or you cannot view it.`      | La clave no existe o la cuenta del token no ve ese proyecto (Jira responde 404 en ambos casos)     |
| `Jira is not available right now. Try again later.`      | Caída o lentitud de Jira, o error de red (el original queda en `cause`)                             |

## Referencias

- [Atlassian: ámbitos de la API REST de Jira Cloud](https://developer.atlassian.com/cloud/jira/platform/scopes-for-oauth-2-3LO-and-forge-apps/)
- Decisiones D-43, D-44 y D-45 en `context/04-decisiones.md`.

# Historias de prueba para YourAutoQA

**Ya creadas en el proyecto YAQ el 2026-11-27: YAQ-5 a YAQ-12, en el mismo orden que esta lista (la 1 es YAQ-5 y la 8, YAQ-12).**

Ocho historias de prueba, de menos a más difícil. Cada una indica la **URL del sistema** dentro de la descripción, porque hoy el agente usa una sola variable `AUT_BASE_URL`. Cómo crearlas: nueva incidencia de tipo **Historia**, el **Resumen** como título y el bloque "Descripción" tal cual.

> El agente detecta el encabezado `Criterios de aceptación:` y separa lo que va debajo. Mantén ese texto exacto.
> Las credenciales de Sauce Demo son públicas (están en su propia pantalla de login). No pongas nunca credenciales reales en un ticket.

---

## 1. Añadir un producto al carrito

**Resumen:** Añadir un producto al carrito y ver el contador

**Descripción:**
```
Sistema: https://www.saucedemo.com (usuario standard_user, contraseña secret_sauce)

Como cliente de la tienda quiero añadir un producto al carrito para comprarlo después.

Criterios de aceptación:
Dado que he iniciado sesión con standard_user
Cuando pulso "Add to cart" en "Sauce Labs Backpack"
Entonces el icono del carrito muestra el número 1
Y el botón del producto pasa a decir "Remove"
```

## 2. Ordenar por precio

**Resumen:** Ordenar los productos por precio de menor a mayor

**Descripción:**
```
Sistema: https://www.saucedemo.com (usuario standard_user, contraseña secret_sauce)

Como cliente quiero ordenar el catálogo por precio para encontrar lo más barato.

Criterios de aceptación:
Dado que he iniciado sesión con standard_user
Cuando elijo la opción "Price (low to high)" en el selector de orden
Entonces el primer producto de la lista es el de menor precio
Y los precios se muestran de menor a mayor
```

## 3. Compra completa

**Resumen:** Completar una compra de principio a fin

**Descripción:**
```
Sistema: https://www.saucedemo.com (usuario standard_user, contraseña secret_sauce)

Como cliente quiero comprar un producto para recibirlo en casa.

Criterios de aceptación:
Dado que he iniciado sesión con standard_user y tengo un producto en el carrito
Cuando voy al carrito, pulso "Checkout" e introduzco nombre "Ana", apellido "Prueba" y código postal "08001"
Y continúo y pulso "Finish"
Entonces veo el mensaje "Thank you for your order!"
```

## 4. Usuario bloqueado (caso negativo)

**Resumen:** Un usuario bloqueado no puede iniciar sesión

**Descripción:**
```
Sistema: https://www.saucedemo.com (usuario locked_out_user, contraseña secret_sauce)

Como responsable de la tienda quiero que un usuario bloqueado no entre para proteger la cuenta.

Criterios de aceptación:
Dado que estoy en la pantalla de login
Cuando intento entrar con locked_out_user y la contraseña secret_sauce
Entonces permanezco en la pantalla de login
Y veo un mensaje de error que indica que el usuario ha sido bloqueado
```

## 5. Contenido que carga con retraso

**Resumen:** Ver el texto que aparece tras una carga dinámica

**Descripción:**
```
Sistema: https://the-internet.herokuapp.com/dynamic_loading/1

Como persona usuaria quiero ver el contenido que se carga después de pulsar un botón.

Criterios de aceptación:
Dado que estoy en la página "Dynamically Loaded Page Elements" (ejemplo 1)
Cuando pulso el botón "Start"
Entonces desaparece la barra de carga
Y aparece el texto "Hello World!"
```

## 6. Subir un archivo

**Resumen:** Subir un archivo y ver la confirmación

**Descripción:**
```
Sistema: https://the-internet.herokuapp.com/upload

Como persona usuaria quiero subir un archivo de texto para adjuntarlo.

Criterios de aceptación:
Dado que estoy en la página "File Uploader"
Cuando selecciono un archivo de texto pequeño y pulso "Upload"
Entonces veo el mensaje "File Uploaded!"
Y se muestra el nombre del archivo subido
```

## 7. Buscar, filtrar y añadir al carrito en una tienda completa

**Resumen:** Buscar un producto y añadirlo al carrito

**Descripción:**
```
Sistema: https://practicesoftwaretesting.com

Como cliente de la tienda quiero buscar una herramienta y añadirla al carrito.

Criterios de aceptación:
Dado que estoy en la página principal sin haber iniciado sesión
Cuando escribo "hammer" en el buscador y pulso buscar
Entonces veo una lista de resultados que contienen "hammer"
Y al abrir el primer resultado y pulsar "Add to cart" el icono del carrito muestra 1
```

## 8. Historia ambigua (prueba de la pausa y la pregunta)

**Resumen:** Gestionar mi perfil

**Descripción:**
```
Sistema: https://www.saucedemo.com

Como cliente quiero gestionar mi perfil para mantener mis datos al día.

Criterios de aceptación:
El perfil se puede editar y guardar correctamente.
```

> Esperado: el agente debe **pausar y preguntar** (qué datos, dónde está el perfil) y, al decirle que la tienda no tiene perfil, terminar en `fail` explicando por qué (D-40 y D-42). Si genera un test inventando pantallas, es un hallazgo para la memoria.

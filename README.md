# Server de la aplicación WEB de itinerarios.

Este es el repositorio para el la creación del servidor de la aplicación para creación de itinerarios en la materia de analisis y diseño de sistemas.

## Configuración del servidor.

1. Si es la primera vez qué se ejecuta

```Bash
    bun i       # Instala las dependencias necesarias.

    bun dev     # Inicia el servidor en modo de desarrollo.
```

2. Si ya lo has ejecutado antes.

```Bash
    bun dev     # Inicia el servidor en modo de desarrollo.
```

3. Crea y llena un archivo `.env` con las variables de entorno correctas, y luego ejecutar el proyecto.
```Py
PORT = 3000

DB_HOST="localhost"
DB_PORT=5432
DB_USER=""
DB_PASSWORD=""
DB_NAME="your database"

# Escribe cualquier cosa, es la firma secreta de los tokens.
SECRET_KEY="Something"

ENVIRONMENT="development"
# HOST="https://harol-lovers.up.railway.app"
HOST="http://localhost:3000"
```


- NOTA: Si usas docker puedes copiar y pegar el siguiente env:

```Py
PORT = 3000

DB_HOST="localhost"
DB_PORT=5432
DB_USER="postgres"
DB_PASSWORD="mysecretpassword"
DB_NAME="sharepath_dev"

# Escribe cualquier cosa, es la firma secreta de los tokens.
SECRET_KEY="Something"

ENVIRONMENT="development"
# HOST="https://harol-lovers.up.railway.app"
HOST="http://localhost:3000"
```

- Y ejecutar el docker compose up en tu terminal

## Reglas para colaborar en el proyecto. 

1. Si no has sido agregado como colaborador del proyecto solicita qué te añada como colaborador del proyecto.

2. Crea una rama con tu nombre sin espacios (Ejemplo: richi) y trabaja ahí.

3. Cuando termines tus cambios NO unas tu rama con la rama principal (main) desde tu computadora, crea un pull request para unir tus cambios a la rama principal.

4. En caso de conflictos, une primero la rama main a tu rama, resuelve los conflictos y vuelve al pull request.

5. En caso de qué hayas añadido rutas al servidor manda foto de las pruebas realizadas.

6. Espera a qué tus cambios sean resueltos y en caso de, realiza los cambios necesarios
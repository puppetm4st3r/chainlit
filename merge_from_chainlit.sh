#!/bin/bash

FORK_REMOTE="origin"
UPSTREAM_REMOTE="upstream"
UPSTREAM_URL="https://github.com/Chainlit/chainlit.git"
SOURCE_BRANCH="main"
TARGET_BRANCH="dev"

SHOW_DIFF=false

# Parsear argumentos
for arg in "$@"; do
  if [[ "$arg" == "--diff" ]]; then
    SHOW_DIFF=true
  fi
done

echo "→ Verificando si existe el remote '$UPSTREAM_REMOTE'..."
if ! git remote | grep -q "$UPSTREAM_REMOTE"; then
  echo "→ Agregando upstream: $UPSTREAM_URL"
  git remote add $UPSTREAM_REMOTE $UPSTREAM_URL
else
  echo "→ Upstream ya está configurado."
fi

echo "→ Realizando fetch de upstream..."
git fetch $UPSTREAM_REMOTE

echo "→ Cambiando a la rama '$TARGET_BRANCH'..."
git checkout $TARGET_BRANCH

if $SHOW_DIFF; then
  echo "→ Mostrando diferencias entre '$TARGET_BRANCH' y '$UPSTREAM_REMOTE/$SOURCE_BRANCH'..."
  git diff $TARGET_BRANCH $UPSTREAM_REMOTE/$SOURCE_BRANCH
  echo
fi

echo "¿Deseas continuar con el merge de '$UPSTREAM_REMOTE/$SOURCE_BRANCH' en '$TARGET_BRANCH'? (s/n)"
read -r continuar
if [[ "$continuar" != "s" ]]; then
  echo "❌ Operación cancelada por el usuario."
  exit 1
fi

echo "→ Haciendo merge de '$UPSTREAM_REMOTE/$SOURCE_BRANCH' en '$TARGET_BRANCH'..."
git merge $UPSTREAM_REMOTE/$SOURCE_BRANCH

if [ $? -eq 0 ]; then
  echo "✅ Merge completado. Los cambios están SOLO en local."
  echo "Puedes revisar, probar o descartar el merge antes de hacer push."
else
  echo "⚠️  Hubo conflictos durante el merge. Resuélvelos manualmente antes de continuar."
fi

echo
echo "Recuerda: nada se subió a GitHub. Si quieres revertir el merge, ejecuta:"
echo "  git reset --hard HEAD~1"
echo "…y tus archivos volverán al estado previo al merge."

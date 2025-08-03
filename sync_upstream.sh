#!/bin/bash

# Script para sincronizar con upstream de forma segura
# Uso: ./sync_upstream.sh
# Funciona desde cualquier directorio dentro del repo de chainlit

set -e

# Verificar que estamos en un repo git
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Error: No estás en un repositorio Git"
    exit 1
fi

CURRENT_BRANCH=$(git branch --show-current)
BACKUP_BRANCH="backup/before-sync-$(date +%Y%m%d-%H%M%S)"

echo "🔄 Iniciando sincronización con upstream..."
echo "📍 Rama actual: $CURRENT_BRANCH"
echo "📂 Directorio: $(pwd)"

# Verificar que existe el remote upstream
if ! git remote | grep -q "upstream"; then
    echo "❌ Error: No existe el remote 'upstream'"
    echo "💡 Agrega el upstream con: git remote add upstream https://github.com/Chainlit/chainlit.git"
    exit 1
fi

# 1. Crear backup de la rama actual
echo "💾 Creando backup: $BACKUP_BRANCH"
git checkout -b "$BACKUP_BRANCH"
git checkout "$CURRENT_BRANCH"

# 2. Fetch upstream
echo "📥 Obteniendo cambios del upstream..."
git fetch upstream

# 3. Verificar si hay cambios para aplicar
if git merge-base --is-ancestor upstream/main HEAD; then
    echo "✅ Tu rama ya está actualizada con upstream/main"
    echo "🗑️  ¿Eliminar backup $BACKUP_BRANCH? (y/n)"
    read -r delete_backup
    if [[ "$delete_backup" == "y" ]]; then
        git branch -D "$BACKUP_BRANCH"
        echo "🗑️  Backup eliminado"
    fi
    exit 0
fi

# 4. Mostrar diferencias antes del rebase
echo "📊 Diferencias que se aplicarán:"
echo "   Commits en upstream/main que no tienes:"
git log --oneline --graph "$CURRENT_BRANCH"..upstream/main | head -10
echo ""
echo "   Commits tuyos que se moverán encima:"
git log --oneline --graph upstream/main.."$CURRENT_BRANCH" | head -5

echo ""
echo "¿Continuar con el rebase? (y/n)"
read -r response
if [[ "$response" != "y" ]]; then
    echo "❌ Operación cancelada"
    git branch -D "$BACKUP_BRANCH" 2>/dev/null || true
    exit 1
fi

# 5. Hacer rebase
echo "🔄 Aplicando rebase..."
if git rebase upstream/main; then
    echo "✅ Rebase exitoso!"
    echo "📊 Estado final:"
    git log --oneline --graph -5
    echo ""
    echo "🗑️  ¿Eliminar backup $BACKUP_BRANCH? (y/n)"
    read -r delete_backup
    if [[ "$delete_backup" == "y" ]]; then
        git branch -D "$BACKUP_BRANCH"
        echo "🗑️  Backup eliminado"
    else
        echo "💾 Backup conservado en: $BACKUP_BRANCH"
    fi
    echo ""
    echo "💡 Para subir los cambios: git push origin $CURRENT_BRANCH --force-with-lease"
else
    echo "⚠️  Conflictos detectados durante el rebase!"
    echo ""
    echo "📋 Para resolver:"
    echo "   1. Edita los archivos en conflicto"
    echo "   2. git add <archivos-resueltos>"
    echo "   3. git rebase --continue"
    echo ""
    echo "📋 Para cancelar el rebase:"
    echo "   git rebase --abort"
    echo "   git checkout $BACKUP_BRANCH"
    echo ""
    echo "💾 Backup disponible en: $BACKUP_BRANCH"
    exit 1
fi

echo "🎉 Sincronización completada!"
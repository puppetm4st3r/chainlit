#!/bin/bash

# Script para sincronizar upstream/main hacia main local automáticamente
# Uso: ./sync_upstream.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

CURRENT_BRANCH=$(git branch --show-current)
BACKUP_BRANCH="backup/main-before-sync-$(date +%Y%m%d-%H%M%S)"

echo -e "${BLUE}🔄 Iniciando sincronización automática upstream/main → main${NC}"
echo -e "${BLUE}📍 Rama actual: $CURRENT_BRANCH${NC}"

# 1. Verificar que estamos en un estado limpio
if [[ -n $(git status --porcelain) ]]; then
    echo -e "${RED}❌ ERROR: Tienes cambios sin commitear${NC}"
    echo "Por favor, commitea o guarda tus cambios antes de continuar"
    exit 1
fi

# 2. Crear backup de la rama main actual
echo -e "${YELLOW}💾 Creando backup de main: $BACKUP_BRANCH${NC}"
git checkout main
git checkout -b "$BACKUP_BRANCH"
git checkout main

# 3. Fetch upstream
echo -e "${BLUE}📥 Obteniendo cambios del upstream...${NC}"
git fetch upstream

# 4. Mostrar cuántos commits nuevos hay
NEW_COMMITS=$(git rev-list --count main..upstream/main)
echo -e "${BLUE}📊 Nuevos commits en upstream: $NEW_COMMITS${NC}"

if [[ $NEW_COMMITS -eq 0 ]]; then
    echo -e "${GREEN}✅ Ya estás actualizado con upstream/main${NC}"
    git branch -D "$BACKUP_BRANCH"
    if [[ "$CURRENT_BRANCH" != "main" ]]; then
        git checkout "$CURRENT_BRANCH"
    fi
    exit 0
fi

# 5. Mostrar los commits que se van a traer
echo -e "${BLUE}📋 Commits que se aplicarán:${NC}"
git log --oneline --graph main..upstream/main | head -10

# 6. Hacer merge automático
echo -e "${BLUE}🔄 Aplicando merge automático...${NC}"
if git merge upstream/main --no-edit; then
    echo -e "${GREEN}✅ Sincronización exitosa!${NC}"
    echo -e "${GREEN}🎉 main actualizado con $NEW_COMMITS nuevos commits${NC}"
    
    # Eliminar backup automáticamente si todo salió bien
    git branch -D "$BACKUP_BRANCH"
    echo -e "${GREEN}🗑️  Backup eliminado automáticamente${NC}"
    
    # Volver a la rama original si no era main
    if [[ "$CURRENT_BRANCH" != "main" ]]; then
        git checkout "$CURRENT_BRANCH"
        echo -e "${BLUE}📍 Volviendo a rama: $CURRENT_BRANCH${NC}"
    fi
    
    echo -e "${GREEN}✅ Sincronización completada exitosamente!${NC}"
else
    echo -e "${RED}🚨 ¡CONFLICTOS DETECTADOS! 🚨${NC}"
    echo -e "${RED}❌ El merge automático falló${NC}"
    echo -e "${RED}⚠️  Esto es raro - main no debería tener conflictos con upstream${NC}"
    echo ""
    echo -e "${YELLOW}🔧 Para resolver manualmente:${NC}"
    echo -e "${YELLOW}   1. Resuelve los conflictos en los archivos${NC}"
    echo -e "${YELLOW}   2. git add .${NC}"
    echo -e "${YELLOW}   3. git commit${NC}"
    echo ""
    echo -e "${BLUE}💾 Backup disponible en: $BACKUP_BRANCH${NC}"
    echo -e "${RED}❌ Script detenido - resuelve conflictos manualmente${NC}"
    exit 1
fi
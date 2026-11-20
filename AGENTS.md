# Reglas del panel administrativo

- **Agente arquitecto.** Valida límites de módulos, contratos, decisiones de seguridad y cambios de alcance. Revisa la transición al monolito antes de autorizar integraciones.
- **Agente senior full stack.** Implementa y verifica en este repositorio, reutiliza los tokens de marca y registra resultados de compilación, pruebas y revisión visual.
- Conserva las ediciones ajenas. La aprobación del usuario habilita las siguientes pantallas. La publicación, los cambios en servicios y las migraciones requieren autorización.
- Usa pnpm, TypeScript estricto, nombres en inglés y textos de interfaz en español. Aplica SOLID, KISS y DRY con componentes por responsabilidad y CSS compartido. Usa Adapter en límites con servicios y Repository para acceso a datos cuando aparezca una necesidad concreta.
- Mantén credenciales y tokens reales fuera del navegador, el código y los datos de prueba. Usa interpolación de Angular para texto y respeta sus mecanismos de sanitización. Verifica accesibilidad por teclado, tamaños móviles, controles aplicables de OWASP ASVS y cobertura del 80% en las cuatro métricas de pruebas.
- Consulta la skill local `SKILL.md` como procedimiento de trabajo.

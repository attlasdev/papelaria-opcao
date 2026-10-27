// As migrations são arquivos .sql embutidos no build pelo Vite (`?raw`).
declare module '*.sql?raw' {
  const sql: string
  export default sql
}

// Todos los errores de la API tienen la misma forma: { error: { code, message } }.
export const errorBody = (code: string, message: string) => ({ error: { code, message } });

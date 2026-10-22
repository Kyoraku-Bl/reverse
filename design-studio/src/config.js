export const IS_STATIC = import.meta.env.VITE_STATIC === true;
export const assetUrl = (name) =>
  import.meta.env.BASE_URL + name.replace(/^\//, "");

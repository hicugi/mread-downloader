export const getFullLink = (value, origin) => {
  if (value.match(/^https?\:\/\//)) {
    return value;
  }

  return `${origin}/${value.replace(/^\//, "")}`;
};

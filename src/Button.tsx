export const Button = (props: React.HTMLProps<HTMLButtonElement>) => {
  return (
    <button
      {...props}
      type="button"
      className={`h-10 flex flex-row items-center transition focus:outline-none text-white bg-purple-700 hover:bg-purple-800 focus:ring-4 focus:ring-purple-300 font-medium rounded-sm text-sm px-5 py-2.5 ${props.className}`}
    >
      {props.children}
    </button>
  );
};

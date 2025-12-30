import { TodoApp } from "@/components/TodoApp";

export function App() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <TodoApp />
      <footer className="text-center mt-8 text-sm text-muted-foreground">
        <p>Double-click to edit a todo</p>
        <p className="mt-2">
          Built with{" "}
          <a
            href="https://github.com/manifesto-ai"
            className="text-primary hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Manifesto
          </a>
          {" "}+{" "}
          <a
            href="https://ui.shadcn.com"
            className="text-primary hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            shadcn/ui
          </a>
          {" "}+{" "}
          <a
            href="https://tailwindcss.com"
            className="text-primary hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Tailwind CSS
          </a>
        </p>
      </footer>
    </div>
  );
}

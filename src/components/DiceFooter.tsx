import Image from "next/image";

export default function DiceFooter() {
  return (
    <footer className="mt-auto w-full pb-2 pt-10">
      <div className="flex justify-center py-8">
        <a
          aria-label="DICE research group"
          className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-4 dark:focus-visible:ring-offset-slate-950"
          href="https://dice-research.org/"
          rel="noreferrer"
          target="_blank"
        >
          <Image
            alt="DICE research group"
            className="h-auto dark:invert"
            height={48}
            src="/dice-logo.svg"
            width={120}
          />
        </a>
      </div>


    </footer>
  );
}

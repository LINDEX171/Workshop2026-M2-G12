import { CSSProperties } from "react";

import { ShowcaseCard } from "./BankCard";

// Pile 3D (du bas vers le haut) : hauteur de chaque carte dans la pile, déphasage de la respiration
const STACK = [
  { index: 2, holder: "Charlie", last4: "0003", z: "0px", delay: "-4s" },
  { index: 1, holder: "Bob", last4: "0002", z: "45px", delay: "-2s" },
  { index: 0, holder: "Alice", last4: "0001", z: "90px", delay: "0s" },
];

// Les 3 cartes Black / Gold / Metal empilées en 3D, soulevées et écartées au survol
// (animations dans index.css : .card-stack, .card-stack-plane, .card-layer)
export default function CardStack({ className = "" }: { className?: string }) {
  return (
    <div className={`card-stack relative ${className}`} aria-hidden="true">
      <div className="card-stack-plane absolute left-1/2 top-[58%] -ml-[9.5rem] -mt-[6rem] aspect-[1.586] w-[19rem]">
        <div className="card-stack-shadow absolute -inset-6" />
        {STACK.map((c) => (
          <div key={c.index} className="card-layer absolute inset-0" style={{ "--z": c.z, "--delay": c.delay } as CSSProperties}>
            <ShowcaseCard index={c.index} holder={c.holder} last4={c.last4} />
          </div>
        ))}
      </div>
    </div>
  );
}

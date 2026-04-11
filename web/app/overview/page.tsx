import Link from 'next/link'
import { Cite, references } from '@/components/dashboard/ReferencesSection'

const sectionIds = {
  intro: 'intro',
  neuralNetwork: 'what-is-a-neural-network',
  howNetworksWork: 'how-neural-networks-work',
  keyTerms: 'key-terms',
  experimentNetworks: 'how-experiment-implements-networks',
  petriDish: 'why-petri-dish',
  organisms: 'what-are-organisms',
  brainsMotivations: 'brains-and-motivations',
  whyTheyAct: 'why-they-act',
  methodology: 'methodology',
  gameTheoryNash: 'game-theory-nash',
  nashDetectionTechnical: 'nash-detection-technical',
  gpuWorkers: 'gpu-workers',
  measuring: 'what-we-measure',
  aiFuture: 'ai-future',
  references: 'references',
} as const

const tocItems: { id: string; label: string; num: number }[] = [
  { id: sectionIds.neuralNetwork, label: 'What is a neural network?', num: 1 },
  { id: sectionIds.howNetworksWork, label: 'How do neural networks work?', num: 2 },
  { id: sectionIds.keyTerms, label: 'Key terms', num: 3 },
  { id: sectionIds.experimentNetworks, label: 'How does this experiment implement neural networks?', num: 4 },
  { id: sectionIds.petriDish, label: 'Why did we choose a petri dish?', num: 5 },
  { id: sectionIds.organisms, label: 'What are the organisms?', num: 6 },
  { id: sectionIds.brainsMotivations, label: 'How do their brains work and what are their motivations?', num: 7 },
  { id: sectionIds.whyTheyAct, label: 'Why do they act the way they do?', num: 8 },
  { id: sectionIds.methodology, label: 'How do we conduct the experiment?', num: 9 },
  { id: sectionIds.gameTheoryNash, label: 'Game theory and Nash equilibrium', num: 10 },
  { id: sectionIds.nashDetectionTechnical, label: 'How we detect Nash equilibrium (technical)', num: 11 },
  { id: sectionIds.gpuWorkers, label: 'Why do we need GPU workers?', num: 12 },
  { id: sectionIds.measuring, label: 'What are we measuring?', num: 13 },
  { id: sectionIds.aiFuture, label: 'Why is this relevant for the future of AI?', num: 14 },
  { id: sectionIds.references, label: 'References', num: 15 },
]

function SectionCard({
  id,
  num,
  title,
  children,
}: {
  id: string
  num: number
  title: string
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 sci-card p-6 md:p-8 animate-fade-in"
    >
      <h2 className="section-heading">
        <span className="section-number">{num}</span>
        {title}
      </h2>
      <div className="text-gray-700 dark:text-gray-300 leading-relaxed space-y-4 text-base md:text-lg pl-10">
        {children}
      </div>
    </section>
  )
}

export default function OverviewPage() {
  return (
    <main className="min-h-screen">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-12 space-y-8">
        {/* Breadcrumb */}
        <nav className="breadcrumb">
          <Link href="/">Dashboard</Link>
          <span className="separator">/</span>
          <span>Overview</span>
        </nav>

        {/* Hero Banner */}
        <div className="hero-banner-sm animate-fade-in">
          <div className="relative z-10">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
              Experiment Overview
            </h1>
            <p className="text-base md:text-lg text-white/75 leading-relaxed max-w-3xl">
              This page explains the EvoNash experiment in plain language: what we do, why we do it,
              and how it connects to game theory, neural networks, and the future of AI. No prior
              background is required.
            </p>
            <div className="flex items-center gap-3 mt-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-white/90 text-xs font-medium backdrop-blur-sm">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                {tocItems.length} sections
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-white/90 text-xs font-medium backdrop-blur-sm">
                ~15 min read
              </span>
            </div>
          </div>
        </div>

        {/* About This Project — Feature Card */}
        <section className="sci-card p-6 md:p-8 animate-fade-in">
          <h2 className="section-heading">
            <span className="section-number">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            About This Project: The Science Fair Experiment at a Glance
          </h2>
          <div className="text-gray-700 dark:text-gray-300 leading-relaxed space-y-6 text-base md:text-lg pl-10">
            <p>
              <strong>EvoNash</strong> is a science fair project that asks a simple question: if we
              let digital &quot;organisms&quot; with tiny artificial brains evolve in a mini world,
              does it help to change their &quot;genes&quot; more when they are doing poorly and
              less when they are doing well? Or is it better to always change them by the same
              amount, like flipping a coin the same way every time? This project builds a real
              experiment—a computer platform that runs on a powerful graphics card<Cite ids={[27]} />—to answer that
              question. Below we explain every part of the experiment in simple terms.
            </p>

            <div className="sci-card p-5 !border-indigo-200 dark:!border-indigo-800/50 !bg-indigo-50/50 dark:!bg-indigo-900/10">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                Abstract (What We Did in One Paragraph)
              </h3>
              <p>
                This experiment tests whether <strong>adaptive mutation</strong><Cite ids={[15, 17]} />—changing an
                organism&apos;s &quot;genes&quot; (the numbers inside its brain) more when the
                parent did poorly and less when the parent did well—helps a population of 1,000
                digital organisms reach a <strong>stable outcome</strong> (called a Nash
                equilibrium<Cite ids={[1, 2]} />) faster than a <strong>control group</strong> that always uses the same
                amount of random change (static mutation). We put the organisms in a simple 2D
                world (a &quot;petri dish&quot;) where they can move, eat food, and shoot at each
                other to steal energy. Their brains are small neural networks<Cite ids={[6, 9]} /> that we do not
                program; we only evolve them by keeping the best performers and randomly mutating
                their weights<Cite ids={[10, 11]} />. We run two groups side by side, measure how many generations it
                takes each group to &quot;settle down,&quot; and use statistics<Cite ids={[21, 22]} /> to see if the
                adaptive group really got there faster. The results tell us whether this kind of
                smart mutation could help future AI and evolutionary algorithms.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                The Problem (Why We Did This)
              </h3>
              <p>
                In many real-world and computer experiments, we use <strong>evolution</strong><Cite ids={[10, 11]} /> to
                improve things: we keep the best performers, copy them with small random changes
                (mutations), and repeat. But how much should we change them? If we change too much
                every time, good solutions get destroyed and we search almost at random<Cite ids={[15]} />. If we
                change too little, we might get stuck in a &quot;local&quot; good outcome and never
                find a better one. Most classic methods use a <strong>fixed</strong> amount of
                mutation—the same for everyone, every time<Cite ids={[17]} />. This project asks: what if we
                <strong> adapt</strong> the amount of mutation to how well the parent did?
                Struggling organisms get more random changes (a chance to try something new);
                successful ones get fewer changes (we keep what works). We wanted to test whether
                that idea actually speeds up how fast a population finds a stable, balanced outcome
                (a Nash equilibrium<Cite ids={[1]} />) in a simple but real experiment.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                The Hypothesis (What We Think Will Happen)
              </h3>
              <p>
                Our <strong>hypothesis</strong> is: if we use adaptive mutation<Cite ids={[15, 16, 17]} />—where the amount
                of random change is <strong>inversely proportional</strong> to the parent&apos;s
                fitness (so low-performing parents produce more heavily mutated offspring, and
                high-performing parents produce less mutated offspring)—then the population will
                reach a Nash equilibrium<Cite ids={[1, 2]} /> (a stable mix of strategies where no one benefits by
                changing alone) in <strong>fewer generations</strong> than a control group that
                uses a fixed mutation rate. In other words, we predict that &quot;smarter&quot;
                mutation will help the population settle down faster.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                Methodology (How We Run the Experiment)
              </h3>
              <p>
                We run <strong>two groups</strong> of experiments. Everything is the same in both
                groups except one thing: <strong>how much we mutate</strong> the offspring. In the
                <strong> control group</strong>, we always add the same small random amount of
                change to the brain weights (static mutation). In the <strong>experimental
                  group</strong>, we add more change when the parent had a low fitness score and less
                change when the parent had a high fitness score (adaptive mutation). For each group we:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Start with 1,000 random neural-network &quot;brains&quot; in the same petri dish world.</li>
                <li>Let them live for many &quot;ticks&quot; (moments)—moving, eating food, and sometimes shooting each other—and track who has the most energy.</li>
                <li>At the end of each generation, we pick the top 20% by fitness score, copy their brains to create offspring, and mutate those copies (more or less depending on the group).</li>
                <li>We repeat for many generations until the population&apos;s behavior <strong>stabilizes</strong>—meaning the mix of strategies stops changing much (we call that reaching Nash equilibrium).</li>
                <li>We record <strong>when</strong> that happened (which generation) and <strong>how well</strong> the population did (peak fitness).</li>
              </ul>
              <p className="mt-2">
                Then we <strong>compare</strong> the two groups using statistics: did the
                adaptive-mutation group reach Nash equilibrium in fewer generations? If yes, that
                supports our hypothesis.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                Why We Use the Same Seed (Fair Start)
              </h3>
              <p>
                To be fair, we start the control and experimental groups with the <strong>same
                  random seed</strong>. A seed is like a recipe that decides the starting
                conditions. Using the same seed means both groups begin with the same kind of
                brains and the same world setup. The <strong>only</strong> thing that is different
                is the mutation strategy. That way, if one group reaches a stable result faster,
                we know it happened because of the mutation strategy—not because it got a luckier
                start.
              </p>
              <p>
                We don&apos;t rely on just one seed. We repeat the experiment with many different
                seeds. This gives us enough data to be confident that the result isn&apos;t just a
                coincidence.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-pink-500"></span>
                Variables (What We Change, What We Measure, What We Keep the Same)
              </h3>
              <p>
                In any good experiment we control what we change and what we measure. Here:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li><strong>What we change (independent variable):</strong> The mutation strategy—fixed (control) vs adaptive (experimental).</li>
                <li><strong>What we measure (dependent variables):</strong> (1) How many generations it took to reach Nash equilibrium (our main outcome), and (2) how high the population&apos;s rating got (peak fitness).</li>
                <li><strong>What we keep the same (constants):</strong> Population size (1,000), the rules of the petri dish (physics, food, shooting), how we select parents (top 20%), and the shape of the neural network (24 inputs, 64 hidden neurons, 4 outputs). Keeping these the same lets us fairly compare the two mutation strategies.</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                Why This Matters
              </h3>
              <p>
                This project combines <strong>evolution</strong><Cite ids={[10, 11]} /> (trial and error over
                generations), <strong>game theory</strong><Cite ids={[3, 4]} /> (Nash equilibrium<Cite ids={[1, 2]} />—when no one benefits
                by changing strategy alone), and <strong>neural networks</strong><Cite ids={[6, 9]} /> (small artificial
                brains). Understanding whether adaptive mutation<Cite ids={[15, 17, 18]} /> speeds up convergence can help
                future AI and evolutionary algorithms—for example, in robotics, multi-agent
                systems<Cite ids={[25]} />, or automated design. The rest of this page explains each part of the
                experiment in more detail, so you can understand exactly what we did and why.
              </p>
            </div>
          </div>
        </section>

        {/* Table of Contents */}
        <nav
          aria-label="Table of contents"
          className="sci-card p-6 animate-fade-in"
        >
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            Contents
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
            {tocItems.map(({ id, label, num }) => (
              <Link
                key={id}
                href={`#${id}`}
                className="toc-link flex items-center gap-3"
              >
                <span className="section-number text-xs">{num}</span>
                <span>{label}</span>
              </Link>
            ))}
          </div>
        </nav>

        {/* Sections */}
        <SectionCard num={1} id={sectionIds.neuralNetwork} title="What is a neural network?">
          <p>
            A <strong>neural network</strong><Cite ids={[6, 7]} /> is a computer model inspired by how brain cells
            work. It is made of many simple &quot;cells&quot; (called neurons) that receive
            numbers, do simple math, and send numbers to other cells. No one programs the network
            step-by-step to solve the problem. Instead, we give it a structure—layers and
            connections—and then we <strong>change the strength of those connections</strong> (the
            &quot;weights&quot;) through learning<Cite ids={[8]} /> or, in our case, evolution<Cite ids={[12]} />.
          </p>
          <p>
            Think of it like a recipe where we only adjust the amounts of ingredients, not the
            steps. In this experiment, each organism&apos;s &quot;brain&quot; is one small neural
            network. It is nothing like a human brain in size or complexity, but the same basic
            idea: numbers go in, math happens, and numbers come out that become actions.
          </p>
        </SectionCard>

        <SectionCard num={2} id={sectionIds.howNetworksWork} title="How do neural networks work?">
          <p>
            The <strong>inputs</strong> are numbers that represent what the organism
            &quot;knows&quot;—for example, how far away the nearest food pellet is, or how
            close the nearest enemy organism is. Since the world wraps around (toroidal
            geometry), there are no walls—just open space in every direction. These numbers
            flow through <strong>layers</strong>. The first layer takes the inputs and multiplies
            them by learned &quot;weights,&quot; adds &quot;biases,&quot; and then applies a simple
            rule (like &quot;if the result is negative, treat it as zero&quot;) so the network
            can learn patterns that are not straight lines. The result becomes the input to
            the next layer, and so on.
          </p>
          <p>
            The <strong>output layer</strong> produces the final numbers. In our experiment, that
            is four numbers that control thrust, turn, shoot, and split (see Key terms below). The
            only thing that changes during evolution is the weights and biases; the layout of the
            network stays the same. If the first weight is big, that input has a big effect on the
            next layer; if it is small, it has a small effect.
          </p>
        </SectionCard>

        <SectionCard num={3} id={sectionIds.keyTerms} title="Key terms">
          <p className="mb-6">
            The following terms are used throughout this overview. They are defined here so you can
            refer back anytime.
          </p>

          <div className="space-y-6">
            <div className="sci-card p-4 !bg-gray-50 dark:!bg-gray-800/50">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Raycasts
              </h3>
              <p>
                &quot;Raycast&quot; is not a common word—it comes from computer graphics. In this
                experiment, <strong>raycasts</strong> are virtual beams or sensors. The organism
                sends out 8 &quot;beams&quot; in different directions (like headlights or radar).
                Each beam reports how far the nearest food pellet or other organism is (and
                sometimes the size of the other organism). So the organism does not
                &quot;see&quot; pictures; it gets 24 numbers (8 directions × 3 types of data).
                Since the world wraps around, there are no walls to hit—the raycasts go on forever
                until they find something or reach maximum range.
              </p>
            </div>

            <div className="sci-card p-4 !bg-gray-50 dark:!bg-gray-800/50">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                The four actions
              </h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Thrust</strong> — The strength of &quot;move forward,&quot; from 0 (don&apos;t
                  move) to 1 (full power). The organism accelerates in the direction it is facing.
                </li>
                <li>
                  <strong>Turn</strong> — Rotate left or right, from -1 to 1. It changes which
                  direction the organism is facing.
                </li>
                <li>
                  <strong>Shoot</strong> — Fire a projectile. If it hits another organism, the
                  shooter steals some of their energy (that is predation). There is a
                  <strong> cooldown</strong>: after shooting, the organism must wait a short time
                  before it can shoot again.
                </li>
                <li>
                  <strong>Split</strong> — Another action with a cooldown; it can be used for
                  reproduction or other abilities in the simulation.
                </li>
              </ul>
            </div>

            <div className="sci-card p-4 !bg-gray-50 dark:!bg-gray-800/50">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Moving</h3>
              <p>
                <strong>Moving</strong> in the experiment is the result of thrust and the
                simulation&apos;s physics. Each moment (each &quot;tick&quot;), the
                organism&apos;s velocity is updated by its thrust, and its position is updated by
                its velocity. So moving = thrust + physics; the organism does not teleport.
              </p>
            </div>

            <div className="sci-card p-4 !bg-gray-50 dark:!bg-gray-800/50">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Fitness Score (in depth)
              </h3>
              <p>
                <strong>Fitness Score</strong> is a number that measures how well an organism
                performed during its lifetime in the petri dish. In our experiment, each
                organism&apos;s fitness is calculated with a simple formula:
              </p>
              <p className="text-center font-mono text-lg my-3">
                <strong>Fitness = Ticks Survived + Remaining Energy</strong>
              </p>
              <p>
                <strong>Ticks survived</strong> is how many moments (out of 750 per generation)
                the organism stayed alive. An organism that survives the entire generation
                gets 750 points for survival alone. <strong>Remaining energy</strong> is how
                much energy the organism still has at the end of the generation. Organisms that
                collected food efficiently and avoided unnecessary energy loss will have more
                energy left over.
              </p>
              <p>
                This means an organism that survives the full generation <em>and</em> ends
                with lots of energy will have the highest fitness score. For example, an
                organism that survived all 750 ticks and ended with 150 energy would score
                750 + 150 = 900. One that died at tick 300 with 0 energy scores just 300.
              </p>
              <p>
                We use fitness scores to select parents (top 20% by score get to reproduce), to set
                the mutation rate in the experimental group (low fitness = more mutation, high fitness
                = less), and to measure how well the population did (peak fitness = highest score
                anyone reached). So fitness score is the single number that drives evolution and our
                statistical analysis.
              </p>
            </div>

            <div className="sci-card p-4 !bg-gray-50 dark:!bg-gray-800/50">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Other terms
              </h3>
              <p>
                <strong>Tick</strong> — One moment or step in the simulation (like one frame in a
                video). <strong>Generation</strong> — One full round of life, then selection,
                breeding, and mutation. <strong>Cooldown</strong> — A wait time before an action
                (e.g. shoot) can be used again. <strong>Metabolism</strong> — The organism losing
                a little energy every tick (like burning calories). <strong>Foraging</strong> —
                Getting energy by eating food pellets. <strong>Predation</strong> — Getting energy
                by shooting another organism and stealing their energy.                 <strong>Policy
                  entropy</strong> — A number that measures how &quot;mixed&quot; or
                &quot;certain&quot; one organism&apos;s decisions are (averaged over the population
                we get mean policy entropy). <strong>Entropy variance</strong> — How much
                organisms differ from each other in that &quot;mixed vs certain&quot; measure;
                when it is low and stable, the population has settled on a similar mix of
                strategies (we use this to detect Nash equilibrium). <strong>Convergence</strong> —
                The population settling into a stable mix of strategies (Nash equilibrium). <strong>Fitness Score</strong> —
                How well an organism did; our primary performance measure. <strong>Weights</strong> —
                The numbers inside the neural network that get evolved. <strong>Mutation</strong> —
                Randomly changing those weights a little when creating offspring.
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard num={4} id={sectionIds.experimentNetworks} title="How does this experiment implement neural networks?">
          <p>
            In this experiment, each organism is controlled by a specific neural network architecture
            often described as <strong>24-64-4</strong>. This code describes the shape of its
            &quot;brain&quot; and how it processes information. You can think of it like a team of
            workers passing messages down a line.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2">
            1. The Inputs: 24 &quot;Eyes&quot; (Sensors)
          </h3>
          <p>
            The network starts with <strong>24 inputs</strong>. Imagine the organism has 8 eyes
            looking in 8 different directions (forward, backward, left, right, and diagonals).
            Each eye measures exactly 3 things:
          </p>
          <ul className="list-disc pl-6 space-y-1 mb-4">
            <li>How far is the nearest <strong>Food</strong> pellet in this direction?</li>
            <li>How far is the nearest <strong>Enemy</strong> organism in this direction?</li>
            <li>How far is the nearest <strong>boundary wrap</strong> point? (Since the world is toroidal—it wraps around like the surface of a donut—there are no walls. This value tells the organism how far it is from the wrap-around edge, which affects how distances to food and enemies are measured.)</li>
          </ul>
          <p>
            With 8 directions × 3 measurements each, that gives us the <strong>24 inputs</strong>.
            These numbers are the only thing the organism &quot;sees.&quot; Because the world wraps
            around, organisms cannot hide in corners or against walls—the environment is completely
            open in every direction.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2">
            2. The Hidden Layer: 64 &quot;Thinkers&quot;
          </h3>
          <p>
            The information then travels to a large <strong>hidden layer</strong> containing
            <strong>64 neurons</strong>.
          </p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li>
              Instead of splitting duties between small groups, this large group of 64 neurons works together to process the
              raw input data. They identify patterns (like "food is close") and calculate the best strategy
              simultaneously. Having more neurons in a single layer allows the network to capture complex
              relationships between the inputs directly.
            </li>
          </ul>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2">
            3. The Outputs: 4 Actions
          </h3>
          <p>
            Finally, the network produces <strong>4 outputs</strong>, which are the instructions sent
            to the organism&apos;s body:
          </p>
          <ul className="list-disc pl-6 space-y-1 mb-4">
            <li><strong>Thrust:</strong> How hard to push forward (0 to 100%).</li>
            <li><strong>Turn:</strong> Which way to steer (-1 for left, +1 for right).</li>
            <li><strong>Shoot:</strong> Whether to fire a projectile (if this number is high enough, it shoots).</li>
            <li><strong>Split:</strong> Whether to reproduce/split (if high enough).</li>
          </ul>
          <p>
            This entire process happens instantly, dozens of times per second, allowing the organism to
            react to its world in real-time.
          </p>
          <p className="mt-4">
            We run 1,000 organisms at once. To do this quickly we use a graphics card (GPU) to run
            all 1,000 brains in parallel—like having 1,000 calculators working at the same time.
            The software runs on the GPU so we can simulate many generations in a reasonable time.
          </p>
        </SectionCard>

        <SectionCard num={5} id={sectionIds.petriDish} title="Why did we choose a petri dish?">
          <p>
            The <strong>petri dish</strong> is our controlled mini-world for the experiment. Think
            of a real petri dish in biology: a simple, closed environment where we can watch life
            (here, digital organisms) under fixed rules. That helps science because we can repeat
            the experiment exactly—same rules, same starting conditions—and change only one thing:
            how much we mutate the &quot;genes&quot; (weights) of the neural networks. So we can
            fairly compare two strategies.
          </p>
          <p>
            The world is 2D (flat, like a tabletop) and continuous (organisms can be anywhere,
            not just on a grid), with wrap-around borders (toroidal geometry): going off one edge
            brings you back on the other side. This means there are no walls or corners to hide
            in—organisms must survive in the open. The physics are simple (movement
            and collisions) so the computer can simulate thousands of organisms without extra
            complexity. The petri dish is our lab bench—simple, repeatable, and designed so we can
            learn about evolution and mutation, not about the environment.
          </p>
        </SectionCard>

        <SectionCard num={6} id={sectionIds.organisms} title="What are the organisms?">
          <p>
            The <strong>organisms</strong> (also called agents) are digital creatures represented
            as circles moving in the 2D petri dish. Each has <strong>energy</strong>—like health or
            fuel. They lose a little energy every moment (metabolism, like burning calories just to
            stay alive) and gain energy in two ways: by eating food (static pellets that give a set
            amount of energy) or by predation (shooting a projectile at another organism to steal
            some of their energy).
          </p>
          <p>
            Foraging is safer but can be slow; predation is riskier but can yield big gains. They
            have no hands or eyes; their only &quot;senses&quot; are the numbers from the raycasts
            and their own state, and their only &quot;actions&quot; are the four outputs (thrust,
            turn, shoot, split). No one programmed them to &quot;go toward food&quot; or
            &quot;avoid enemies&quot;—they only have a brain (neural network) that turns what they
            sense into actions. Over time, organisms that keep their energy high survive and
            reproduce; others die out.
          </p>
        </SectionCard>

        <SectionCard num={7} id={sectionIds.brainsMotivations} title="How do their neural network brains work and what are their motivations?">
          <p>
            Each moment (tick), every organism gets a list of 24 numbers: from 8 directions, how
            far to the nearest food and enemy (and sometimes enemy size), plus a few
            numbers about itself (energy level, speed, whether it is on cooldown for shooting or
            splitting). That list is the input to its neural network. The network outputs 4 numbers
            that control thrust, turn, shoot, and split.
          </p>
          <p>
            No one programmed the organisms to &quot;go toward food&quot; or &quot;avoid
            enemies.&quot; The network just has weights that get evolved; any &quot;strategy&quot;
            we see (foraging, fleeing, attacking) emerges from which organisms had more offspring.
            So their motivation is not written in code; it is implicit: organisms that by chance
            behave in ways that keep energy high get to reproduce, so over many generations the
            population tends to act in ways that help survival. We measure their success with a
            fitness score (see Key terms)—higher fitness means they tend to &quot;win&quot; more
            often in our pairwise comparisons. Think of it like nature selecting the best
            survivors.
          </p>
        </SectionCard>

        <SectionCard num={8} id={sectionIds.whyTheyAct} title="Why do they act the way they do?">
          <p>
            We do not tell the organisms how to behave. We only select the best performers (top
            20% by fitness score), copy their neural network weights to create offspring, and randomly
            change (mutate) those weights a little. So &quot;why they act the way they do&quot; is:
            their brains were shaped by many generations of trial and error.
          </p>
          <p>
            Organisms that happened to have weights that led to good survival and reproduction left
            more copies; bad strategies died out. It is like breeding dogs for speed—we did not
            design the legs; we just kept the fastest and over time they got faster. At the start,
            behavior is almost random; after many generations we often see recognizable strategies
            (some organisms forage, some attack) because those strategies won in the petri dish.
            They act the way they do because evolution favored those behaviors in this environment.
          </p>
        </SectionCard>

        <SectionCard num={9} id={sectionIds.methodology} title="How do we conduct the experiment?">
          <p>
            We run two groups of experiments, identical in every way except how much we mutate the
            offspring.
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Control group</strong> — We use a fixed mutation amount (we always change the
              weights by the same small random amount), like flipping a coin the same way every
              time.
            </li>
            <li>
              <strong>Experimental group</strong> — We use adaptive mutation: we change the weights
              more when the parent did poorly and less when the parent did well. Struggling
              organisms get more random changes (more chance to try something new); successful ones
              get fewer changes (we keep what works).
            </li>
          </ul>
          <p>
            For each group we start with 1,000 random neural networks, run the petri dish for many
            generations (each generation = one round of life, selection, breeding, and mutation),
            and we stop when the population&apos;s behavior stabilizes—meaning the mix of
            strategies stops changing much. We call that approaching a Nash equilibrium (see next
            section). We record when that happened (which generation) and how well the population
            did (peak rating). Then we compare the two groups: did the adaptive-mutation group
            reach stability faster? We use statistics to check if the difference is real or just
            luck.
          </p>
        </SectionCard>

        <SectionCard num={10} id={sectionIds.gameTheoryNash} title="What is game theory? What is Nash equilibrium? Why is it the key metric?">
          <p>
            <strong>Game theory</strong><Cite ids={[3]} /> is the study of situations where multiple
            decision-makers (players) choose actions, and each person&apos;s outcome depends not
            only on their own choice but on what others do. Think of two people dividing a pizza: if
            you ask for more, the other might take less; your best choice depends on what you think
            they will do. In our experiment, the &quot;players&quot; are the organisms. Each one
            chooses how to behave (forage, attack, flee) based on its neural network, and its
            success (energy, survival, reproduction) depends on what the other 999 are doing. So the
            petri dish is a &quot;game&quot; in the game-theory sense<Cite ids={[25]} />.
          </p>
          <p>
            <strong>Nash equilibrium</strong><Cite ids={[1, 2]} /> is a situation where no one can improve their outcome
            by changing their strategy alone, given what everyone else is doing. It is named after
            the mathematician John Nash. At a Nash equilibrium, if you are the only one who
            switches from &quot;forage&quot; to &quot;attack,&quot; you don&apos;t do better—so no
            one has a reason to switch. It describes a stable outcome: everyone is doing the best
            they can given what others do.
          </p>
          <p>
            In our experiment, each organism has a strategy (the way its brain turns inputs into
            actions). The population has a mix of strategies<Cite ids={[4, 5]} />. We say the population has reached a
            Nash-like equilibrium when the mix of strategies stops changing from generation to
            generation: the kinds of behavior have settled into a stable balance. At that point, no
            organism would do better by behaving differently, given how the rest of the population
            is behaving. We detect this by watching <strong>entropy variance</strong><Cite ids={[28]} />—how much
            the organisms differ from each other in how &quot;mixed&quot; or &quot;certain&quot;
            their decisions are. When everyone is behaving similarly, that difference drops and
            stays low; when it stays low for many generations in a row, we treat that as having
            reached Nash equilibrium.
          </p>
          <p>
            <strong>Why Nash equilibrium is the key metric:</strong> Our hypothesis is that
            adaptive mutation helps the population reach Nash equilibrium faster than fixed
            mutation. So the key metric is how many generations it takes to reach Nash
            equilibrium—that is our primary outcome. If the adaptive-mutation group reaches Nash
            equilibrium in fewer generations than the control group, that supports the hypothesis.
            Nash equilibrium is not just a fancy name for &quot;they settled down&quot;—it is the
            specific, stable outcome from game theory that we use to define &quot;settled,&quot; and
            the generation at which we reach it is the main number we use to test our hypothesis.
          </p>
        </SectionCard>

        <SectionCard num={11} id={sectionIds.nashDetectionTechnical} title="How we detect Nash equilibrium (technical)">
          <p>
            <strong>Detection criterion.</strong> Nash equilibrium<Cite ids={[1, 2]} /> is detected using
            <strong> entropy variance</strong><Cite ids={[28]} /> across the population, not mean policy entropy.
            For each generation we compute a scalar <strong>policy entropy</strong> per agent
            (expected entropy of the action distribution over a fixed set of sample inputs).
            The <strong>entropy variance</strong> is the variance of those per-agent entropies
            across the population.
          </p>
          <p>
            <strong>Why variance rather than mean entropy.</strong> Mean policy entropy
            indicates how mixed or deterministic the average policy is, but it does not
            measure population-level homogeneity. At equilibrium we require that the
            strategy mix has stabilized<Cite ids={[4]} />—i.e., that agents no longer differ substantially
            in behavior. That corresponds to low <em>variance</em> of policy entropy across
            agents: when all agents have similar entropies, the population has converged
            to a homogeneous strategy mix. We therefore define convergence as the
            generation at which entropy variance falls below a threshold and remains
            below it for a fixed stability window (after an initial phase of
            divergence), with a post-convergence buffer to confirm stability.
          </p>
        </SectionCard>

        <SectionCard num={12} id={sectionIds.gpuWorkers} title="Why do we need GPU workers?">
          <p>
            We have 1,000 organisms, each with a neural network that does many multiplications every
            moment, and we run hundreds of generations. Doing that on an ordinary computer (CPU)
            would take a very long time—hours or days. A GPU (graphics card) is built to do
            thousands of simple math operations at once (originally for drawing graphics). We use
            it to run all 1,000 brains in parallel—like having 1,000 people each do one
            multiplication at the same time instead of one person doing 1,000.
          </p>
          <p>
            <strong>Workers</strong> are the computers that have the GPU and actually run the
            simulation. The website you see is the &quot;controller&quot;; it sends the experiment
            settings to a worker, the worker runs the petri dish and evolution on its GPU, and
            sends the results back. So we need GPU workers to finish the experiment in a reasonable
            time and to separate the heavy computation (worker) from the interface and storage (web
            app). Think of the worker as a lab technician who runs the experiment and mails back
            the data.
          </p>
        </SectionCard>

        <SectionCard num={13} id={sectionIds.measuring} title="What are we measuring?">
          <p>
            The <strong>primary</strong> metric for proving our hypothesis is how many generations
            it takes to reach Nash equilibrium (convergence velocity). The other metrics (peak
            fitness, policy entropy) support the analysis, but convergence to Nash is the key
            outcome we compare between the two groups.
          </p>
          <p>
            Important detail: <strong>Fitness score</strong> tells us how well organisms did, while
            <strong>entropy variance</strong> tells us how similar their decision-making styles are.
            Two groups could have similar fitness but still behave differently. That is why we track
            both performance <em>and</em> behavior.
          </p>
          <ul className="list-disc pl-6 space-y-3">
            <li>
              <strong>Convergence velocity</strong> (&quot;when did they reach Nash
              equilibrium?&quot;) — We record the generation number at which the population&apos;s
              behavior becomes stable: the variety of strategies (who forages, who attacks) stops
              changing much from generation to generation. We check this using <strong>entropy
                variance</strong>—how much the organisms differ from each other in how mixed or
              certain their decisions are. When that difference is small and stays small for many
              generations, everyone is behaving similarly and we say we have reached a Nash-like
              equilibrium. So convergence velocity = how many generations it took to get there.
              Faster convergence = fewer generations.
            </li>
            <li>
              <strong>Peak fitness</strong> (&quot;how good did they get?&quot;) — We record the
              highest fitness score that any organism (or the population) reached (see Key terms for
              how we calculate it). This tells us how well the evolved strategies performed in the
              petri dish.
            </li>
            <li>
              <strong>Policy entropy</strong> (&quot;how predictable are one organism&apos;s
              decisions?&quot;) — This number tells us whether an organism is still experimenting
              (high entropy) or has settled on a stable style (low entropy). We look at the
              <strong> variance</strong> of that number across all organisms to detect
              equilibrium: when the variance is low, everyone is similar; when it stays low for
              many generations, we have reached Nash equilibrium.
            </li>
          </ul>
          <p>
            We are measuring how fast the population stabilizes and how well it does, and we
            compare these between the control and experimental groups.
          </p>
        </SectionCard>

        <SectionCard num={14} id={sectionIds.aiFuture} title="Why is this relevant for the future of AI, and how could it be expanded?">
          <p>
            This experiment sits at the intersection of three powerful fields:
            <strong> evolutionary computing</strong><Cite ids={[10, 11, 12]} /> (improving AI through trial and error over
            generations), <strong>game theory</strong><Cite ids={[3, 4, 5]} /> (understanding strategic decision-making
            when multiple agents interact), and <strong>neural networks</strong><Cite ids={[6, 8, 9]} /> (giving agents
            brains that can process information and make decisions). That combination isn&apos;t
            just academic—it has direct applications to some of the most important challenges
            facing humanity.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            Real-World Applications
          </h3>
          <ul className="list-disc pl-6 space-y-3">
            <li>
              <strong>Autonomous vehicles and robotics:</strong> Self-driving cars must constantly
              make decisions in a world full of other drivers, pedestrians, and cyclists—all making
              their own decisions simultaneously. This is exactly the kind of multi-agent game
              theory problem our experiment studies. If adaptive mutation helps populations of AI
              agents find stable strategies faster, that same principle could help robot fleets
              (warehouse robots, delivery drones, self-driving trucks) learn to coordinate
              efficiently without crashing into each other.
            </li>
            <li>
              <strong>Economics and market design:</strong> Stock markets, auctions, and supply
              chains are all systems where many agents (traders, companies, consumers) interact
              strategically. Economists use Nash Equilibrium to predict market outcomes. Our
              experiment tests whether there are faster ways to find these equilibria—which could
              help design fairer auction systems, more efficient markets, or better pricing
              algorithms.
            </li>
            <li>
              <strong>Drug discovery and protein design:</strong> Pharmaceutical companies use
              evolutionary algorithms to search through billions of possible molecular structures
              to find effective drugs. The question of &quot;how much should we mutate?&quot; is
              directly relevant—adaptive mutation could help these searches converge on promising
              drug candidates faster, potentially saving years of research time.
            </li>
            <li>
              <strong>Climate and resource management:</strong> Managing shared resources (fisheries,
              forests, water supplies) involves many stakeholders making independent decisions.
              Game theory helps model these &quot;tragedy of the commons&quot; situations. Understanding
              how populations converge to stable strategies could inform policies that help communities
              reach sustainable equilibria faster.
            </li>
            <li>
              <strong>Multi-agent AI systems:</strong> As AI becomes more common, we increasingly have
              situations where multiple AI systems interact—chatbots negotiating, trading algorithms
              competing, or recommendation systems influencing each other. Understanding how
              populations of AI agents reach equilibrium is crucial for ensuring these systems
              behave predictably and safely.
            </li>
            <li>
              <strong>Cybersecurity:</strong> Attackers and defenders in cybersecurity are engaged in
              a constant strategic game. Evolutionary approaches to security (where defense
              strategies evolve in response to attacks) could benefit from adaptive mutation to
              find robust defense strategies more quickly.
            </li>
          </ul>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
            Why Adaptive Mutation Matters Beyond This Experiment
          </h3>
          <p>
            The core question—&quot;should we change things more when they&apos;re not working and
            less when they are?&quot;—is fundamental to optimization everywhere. Currently, most
            evolutionary algorithms use fixed mutation rates, which is like always turning every knob
            by the same amount regardless of whether you&apos;re close to a good solution or far
            away. If our experiment demonstrates that adaptive mutation accelerates convergence,
            that finding could be applied to:
          </p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li>Training neural networks more efficiently (reducing the enormous energy cost of training large AI models)<Cite ids={[13, 14]} /></li>
            <li>Optimizing engineering designs (aircraft wings, circuit layouts, antenna shapes) faster<Cite ids={[11]} /></li>
            <li>Evolving game-playing AI (like AlphaGo&apos;s successors) with less computational cost<Cite ids={[26]} /></li>
            <li>Accelerating scientific simulations that use evolutionary search methods<Cite ids={[17, 18]} /></li>
          </ul>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
            How This Experiment Could Be Expanded
          </h3>
          <p>
            This kind of experiment could grow in many directions. We could use bigger or more
            complex worlds (3D environments, multiple food types, predator-prey ecosystems), larger
            populations or bigger neural networks, or entirely different mutation strategies
            (for example, letting the organisms <em>learn</em> their own mutation rate over time).
            We could also introduce cooperation (organisms that work together to hunt) or
            communication (organisms that signal to each other), creating richer game-theoretic
            scenarios. The goal is to show that evolutionary game-theoretic experiments can scale
            from a science fair project to tools that benefit both scientific research and real-world
            industry.
          </p>
        </SectionCard>

        {/* Section 15 – References */}
        <section
          id={sectionIds.references}
          className="scroll-mt-24 sci-card p-6 md:p-8 animate-fade-in"
        >
          <h2 className="section-heading">
            <span className="section-number">15</span>
            References
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 pl-10">
            {references.length} sources across {Array.from(new Set(references.map((r) => r.category))).length} categories
          </p>
          <div className="space-y-8 pl-2 md:pl-10">
            {Array.from(new Set(references.map((r) => r.category))).map((category) => (
              <div key={category}>
                <h3 className="text-sm font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  {category}
                </h3>
                <ol className="space-y-3">
                  {references
                    .filter((r) => r.category === category)
                    .map((ref) => (
                      <li
                        key={ref.id}
                        id={`overview-ref-${ref.id}`}
                        className="flex gap-3 text-sm leading-relaxed text-gray-700 dark:text-gray-300"
                      >
                        <span className="flex-shrink-0 w-7 h-7 rounded-md bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-500 dark:text-gray-400 mt-0.5">
                          {ref.id}
                        </span>
                        <div>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {ref.authors}
                          </span>{' '}
                          ({ref.year}).{' '}
                          <em>{ref.title}</em>.{' '}
                          <span className="text-gray-500 dark:text-gray-400">
                            {ref.source}
                          </span>
                          {ref.doi && (
                            <>
                              {' '}
                              <a
                                href={`https://doi.org/${ref.doi}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 underline decoration-dotted underline-offset-2"
                              >
                                doi:{ref.doi}
                              </a>
                            </>
                          )}
                          {!ref.doi && ref.url && (
                            <>
                              {' '}
                              <a
                                href={ref.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 underline decoration-dotted underline-offset-2"
                              >
                                [Link]
                              </a>
                            </>
                          )}
                        </div>
                      </li>
                    ))}
                </ol>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}

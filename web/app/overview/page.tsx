import Link from 'next/link'
import Image from 'next/image'
import { Cite, references } from '@/components/dashboard/ReferencesSection'
import {
  DynamicPValue,
  DynamicCohensD,
  DynamicExperimentCount,
  DynamicConvergedPerGroup,
  DynamicSingleExperimentScale,
  DynamicFullStudyScale,
  DynamicGenerationRows,
  DynamicStatsSummaryLine,
  DynamicMaxGenerations,
  DynamicPairedWinHeadline,
  DynamicSignTest,
  DynamicPairedTTest,
  DynamicPairedCI,
  DynamicWilsonCI,
  DynamicPairedMeanDiff,
  DynamicMagnitudeRatio,
  DynamicExtremes,
  DynamicSensitivityTable,
  DynamicConvergenceDisparity,
  DynamicMatchedMeans,
  DynamicAdaptiveWinPct,
  DynamicControlWinPct,
  DynamicMeanDiffGens,
  DynamicCIBracket,
  DynamicCILower,
  DynamicCIUpper,
  DynamicPValueStrength,
  DynamicCohensDQualifier,
  DynamicCohensDzQualifier,
  DynamicCohensDDirection,
  DynamicSignTestVerdict,
  DynamicCILowerStrength,
  DynamicWilsonStrength,
  DynamicMagnitudeVerdict,
  DynamicMatchedDirection,
  DynamicExtremesComparison,
  DynamicHypothesisVerdict,
  DynamicCIZeroAssertion,
} from '@/components/OverviewDynamicStats'

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
  entropyVsVariance: 'entropy-vs-variance',
  howWeMeasure: 'how-we-measure',
  statisticalTests: 'statistical-tests',
  seedPairs: 'seed-pairs',
  whyAdaptiveWins: 'why-adaptive-wins-overall',
  iqrAndCI: 'iqr-and-confidence-intervals',
  dataScale: 'data-scale',
  aiFuture: 'ai-future',
  tryItYourself: 'try-it-yourself',
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
  { id: sectionIds.entropyVsVariance, label: 'Policy entropy vs. entropy variance', num: 14 },
  { id: sectionIds.howWeMeasure, label: 'How do we measure and report results?', num: 15 },
  { id: sectionIds.statisticalTests, label: 'Understanding the statistical tests', num: 16 },
  { id: sectionIds.seedPairs, label: 'Seed pairs: matched experiments and data integrity', num: 17 },
  { id: sectionIds.whyAdaptiveWins, label: 'Why adaptive wins overall — even when individual seeds disagree', num: 18 },
  { id: sectionIds.iqrAndCI, label: 'IQR and confidence intervals', num: 19 },
  { id: sectionIds.dataScale, label: 'The scale of this experiment', num: 20 },
  { id: sectionIds.aiFuture, label: 'Why is this relevant for the future of AI?', num: 21 },
  { id: sectionIds.tryItYourself, label: 'Try it yourself', num: 22 },
  { id: sectionIds.references, label: 'References', num: 23 },
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
            <p className="text-base md:text-lg text-white/75 leading-relaxed max-w-3xl mb-6">
              This page explains the EvoNash experiment in plain language: what we do, why we do it,
              and how it connects to game theory, neural networks, and the future of AI. No prior
              background is required.
            </p>
            <div className="mb-6 rounded-xl overflow-hidden border border-white/20 shadow-xl max-w-4xl mx-auto md:mx-0 bg-black/50 backdrop-blur-sm">
              <Image 
                src="/petri-dish.png" 
                alt="EvoNash digital petri dish with glowing circular organisms" 
                width={1024} 
                height={1024} 
                className="w-full h-auto"
              />
            </div>
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

        <SectionCard num={14} id={sectionIds.entropyVsVariance} title="Policy entropy vs. entropy variance — what's the difference?">
          <p>
            Two of the most important numbers in this experiment sound similar — <strong>policy
            entropy</strong> and <strong>entropy variance</strong> — but they measure very
            different things. Understanding the distinction is critical to understanding how we
            detect Nash equilibrium.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            Policy entropy: &quot;How random is ONE organism&apos;s behavior?&quot;
          </h3>
          <p>
            Imagine an organism standing in the petri dish. It has four possible actions: move
            forward, turn left, turn right, or boost. If its neural network says <strong>&quot;82%
            forward, 7% left, 5% right, 6% boost&quot;</strong>, that organism has a clear
            preference — it almost always goes forward. Its <strong>policy entropy is low</strong>.
          </p>
          <p>
            On the other hand, if the neural network says <strong>&quot;25% forward, 25% left, 25%
            right, 25% boost&quot;</strong>, the organism is essentially flipping a coin every time.
            It has no strategy. Its <strong>policy entropy is high</strong>.
          </p>
          <p>
            Mathematically, for a single organism with action probabilities p₁, p₂, p₃, p₄:
          </p>
          <div className="sci-card p-4 !bg-gray-50 dark:!bg-gray-800/50">
            <p className="font-mono text-sm text-center">
              H = &minus;(p₁&middot;log(p₁) + p₂&middot;log(p₂) + p₃&middot;log(p₃) + p₄&middot;log(p₄))
            </p>
          </div>
          <p>
            The number we report on the dashboard as &quot;policy entropy&quot; is the
            <strong> average</strong> of this value across 200 sampled organisms. It tells us:
            on average, how decisive is the typical organism?
          </p>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
            Entropy variance: &quot;How DIFFERENT are the organisms FROM EACH OTHER?&quot;
          </h3>
          <p>
            Policy entropy tells us about the average individual. Entropy variance tells us whether
            all the individuals <strong>agree</strong>. We take the entropy of each sampled organism
            and compute the <strong>variance</strong> (statistical spread) across the whole group:
          </p>
          <div className="sci-card p-4 !bg-gray-50 dark:!bg-gray-800/50">
            <p className="font-mono text-sm text-center">
              Variance = (1/n) &times; &Sigma;(H&#x1D62; &minus; H&#x0304;)&sup2;
            </p>
            <p className="text-xs text-gray-500 text-center mt-1">
              where H&#x1D62; is each organism&apos;s entropy and H&#x0304; is the average entropy
            </p>
          </div>
          <p>
            Low variance means all organisms have <strong>similar</strong> entropy values. High
            variance means some are decisive while others are still confused.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Why variance matters more than entropy for detecting Nash equilibrium
          </h3>
          <p>
            Here is the key insight: <strong>you can have low average entropy but high variance,
            and it is NOT Nash equilibrium.</strong> Three scenarios illustrate this:
          </p>

          <div className="space-y-3 mt-3">
            {/* Scenario A */}
            <div className="sci-card p-4 !bg-green-50 dark:!bg-green-900/20 border-green-200 dark:border-green-800/40">
              <h4 className="text-sm font-semibold text-green-700 dark:text-green-400 mb-1">✓ Scenario A: Low entropy, LOW variance — Nash equilibrium</h4>
              <div className="font-mono text-xs space-y-0.5 text-gray-700 dark:text-gray-300">
                <p>Organism 1: H = 0.30 (always goes forward)</p>
                <p>Organism 2: H = 0.31 (always goes forward)</p>
                <p>Organism 3: H = 0.29 (always goes forward)</p>
              </div>
              <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                Average entropy: 0.30 (low) &bull; Variance: 0.0001 (low) &bull;
                <strong> Everyone converged on the same strategy.</strong>
              </p>
            </div>

            {/* Scenario B */}
            <div className="sci-card p-4 !bg-red-50 dark:!bg-red-900/20 border-red-200 dark:border-red-800/40">
              <h4 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">✗ Scenario B: Low entropy, HIGH variance — NOT Nash equilibrium</h4>
              <div className="font-mono text-xs space-y-0.5 text-gray-700 dark:text-gray-300">
                <p>Organism 1: H = 0.10 (always attacks)</p>
                <p>Organism 2: H = 1.20 (still exploring randomly)</p>
                <p>Organism 3: H = 0.05 (always runs away)</p>
              </div>
              <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                Average entropy: 0.45 (moderate) &bull; Variance: 0.42 (high) &bull;
                <strong> Different strategies, no consensus — population is still in flux.</strong>
              </p>
            </div>

            {/* Scenario C */}
            <div className="sci-card p-4 !bg-yellow-50 dark:!bg-yellow-900/20 border-yellow-200 dark:border-yellow-800/40">
              <h4 className="text-sm font-semibold text-yellow-700 dark:text-yellow-400 mb-1">⟳ Scenario C: High entropy, LOW variance — Starting conditions (generation 0)</h4>
              <div className="font-mono text-xs space-y-0.5 text-gray-700 dark:text-gray-300">
                <p>Organism 1: H = 1.35 (random)</p>
                <p>Organism 2: H = 1.38 (random)</p>
                <p>Organism 3: H = 1.34 (random)</p>
              </div>
              <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">
                Average entropy: 1.36 (high) &bull; Variance: 0.0003 (low) &bull;
                <strong> Everyone is equally confused — this is where all experiments start.</strong>
              </p>
            </div>
          </div>

          <p className="mt-4">
            This is exactly why our convergence detection algorithm requires the population to
            <strong> diverge first</strong> (variance goes up as organisms develop different
            strategies) and then <strong>re-converge</strong> (variance drops back down as they
            settle on a shared equilibrium). Only when variance stays low for 20 consecutive
            generations <em>after</em> having been high do we declare Nash equilibrium.
          </p>

          <div className="sci-card p-4 !bg-indigo-50 dark:!bg-indigo-900/20 border-indigo-200 dark:border-indigo-800/40 mt-3">
            <p className="text-xs text-indigo-700 dark:text-indigo-300">
              <strong>In one sentence: </strong>
              Policy entropy tells you what the average organism is doing. Entropy variance tells
              you whether they&apos;re all doing the <strong>same thing</strong> — and that
              consensus is what defines Nash equilibrium.
            </p>
          </div>
        </SectionCard>

        <SectionCard num={15} id={sectionIds.howWeMeasure} title="How do we measure and report results?">
          <p>
            The previous sections explain <strong>what</strong> we measure (convergence velocity,
            peak fitness, policy entropy). This section explains <strong>how</strong> the software
            actually captures those numbers from the organisms—step by step, in plain language.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            Step 1: Give every organism the same &quot;pop quiz&quot;
          </h3>
          <p>
            We create a set of fake scenarios—like &quot;there&apos;s food to your left and an
            enemy ahead.&quot; These are just made-up sensor readings (24 numbers). Every organism
            gets the <strong>exact same quiz</strong> so we can compare their answers fairly.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
            Step 2: See what each organism would do
          </h3>
          <p>
            We feed those fake scenarios into each organism&apos;s neural network brain. The brain
            spits out 4 numbers—one for each action (thrust, turn, shoot, split). For example:
          </p>
          <div className="sci-card p-4 !bg-gray-50 dark:!bg-gray-800/50 font-mono text-sm space-y-1">
            <p><strong>Organism A:</strong> [2.5, 0.1, 0.3, 0.1] &larr; strongly wants to move forward</p>
            <p><strong>Organism B:</strong> [0.5, 0.4, 0.6, 0.5] &larr; can&apos;t really decide</p>
          </div>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Step 3: Convert to percentages
          </h3>
          <p>
            We turn those raw numbers into percentages that add up to 100% (using a math function
            called <strong>softmax</strong>). Now the answers are easy to read:
          </p>
          <div className="sci-card p-4 !bg-gray-50 dark:!bg-gray-800/50 font-mono text-sm space-y-1">
            <p><strong>Organism A:</strong> [82%, 7%, 5%, 6%] &larr; &quot;I&apos;m going forward, no question&quot;</p>
            <p><strong>Organism B:</strong> [25%, 23%, 28%, 24%] &larr; &quot;Uhhh&hellip; maybe shoot? I dunno&quot;</p>
          </div>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
            Step 4: Measure how indecisive each one is (policy entropy)
          </h3>
          <p>
            We plug those percentages into the <strong>entropy formula</strong>. You don&apos;t need
            to know the math—just know that it produces a single number:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Organism A</strong> &rarr; low entropy (~0.3) — it knows exactly what it wants.
              Think of a student who circles &quot;A&quot; without hesitation.
            </li>
            <li>
              <strong>Organism B</strong> &rarr; high entropy (~1.4) — it&apos;s basically guessing.
              Think of a student who stares at the test and randomly picks an answer.
            </li>
          </ul>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            Step 5: Check if everyone agrees (entropy variance)
          </h3>
          <p>
            Now we have an &quot;indecisiveness score&quot; for each of the 200 sampled organisms. We
            ask: <strong>&quot;Are these scores all similar, or are they all over the place?&quot;</strong>
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              If the scores are <strong>[0.3, 0.31, 0.29, 0.3, 0.28&hellip;]</strong> &rarr; <strong>low
              variance</strong> &rarr; everyone behaves the same way &rarr; the population has settled
              on a shared strategy.
            </li>
            <li>
              If the scores are <strong>[0.3, 1.2, 0.8, 0.1, 1.4&hellip;]</strong> &rarr; <strong>high
              variance</strong> &rarr; organisms are doing their own thing &rarr; still evolving,
              haven&apos;t reached agreement yet.
            </li>
          </ul>
          <p>
            Think of it like a classroom: <strong>low variance</strong> means everyone got roughly the
            same grade on the test (they all &quot;agree&quot;). <strong>High variance</strong> means grades
            are scattered from 20% to 95%—everyone is different.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
            Step 6: Detect Nash equilibrium
          </h3>
          <p>
            We repeat Steps 1–5 <strong>every single generation</strong> and track the entropy
            variance over time. When it drops below a small threshold (0.01) and stays there for
            20 generations in a row—after the population has already spread out and tried different
            strategies—we declare that the population has reached <strong>Nash equilibrium</strong>.
            We record which generation that happened at. That generation number is the key result
            we compare between the control and experimental groups.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
            Step 7: Compare the two groups with statistics
          </h3>
          <p>
            After running many experiments in both the control and experimental groups, we have a
            list of convergence generation numbers for each group—for example, the control group
            might converge at generations [230, 241, 225, 238, &hellip;] and the experimental group
            at [210, 195, 208, 193, &hellip;]. We use a standard statistical test (Welch&apos;s
            t-test) to answer one question: <strong>&quot;Is the difference between these two lists
            real, or could it be just luck?&quot;</strong>
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              The <strong>p-value</strong> tells us the probability that the difference happened by
              random chance. A very small p-value (like 0.001) means there&apos;s only a 0.1% chance
              the result is a fluke—so we&apos;re confident the difference is real.
            </li>
            <li>
              The <strong>effect size</strong> (Cohen&apos;s d) tells us <em>how big</em> the
              difference is. A small p-value says &quot;the difference is real&quot;; the effect size
              says &quot;and the difference is large&quot; (or small, or medium).
            </li>
          </ul>
          <p>
            The dashboard displays all of these results automatically as experiments finish—the
            convergence generation for each experiment, the statistical comparison between groups,
            and the conclusion of whether the hypothesis is supported.
          </p>
        </SectionCard>

        <SectionCard num={16} id={sectionIds.statisticalTests} title="Understanding the statistical tests">
          <p>
            After running hundreds of experiments in both the control and experimental groups, we
            need to answer two questions: <strong>&quot;Is the difference real?&quot;</strong> and
            <strong>&quot;How big is the difference?&quot;</strong> We use two standard scientific
            tools to answer them.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            Welch&apos;s t-test: &quot;Is the difference real, or just luck?&quot;
          </h3>
          <p>
            Imagine you have two coins. You flip each one 100 times. Coin A lands on heads 53 times
            and Coin B lands on heads 58 times. Is Coin B actually weighted differently, or did it
            just get lucky? That&apos;s exactly what a <strong>t-test</strong> answers.
          </p>
          <p>
            In our experiment, the &quot;coins&quot; are the two groups (control vs. experimental),
            and the &quot;number of heads&quot; is the generation number where each experiment
            converged. We collect all the convergence generations from each group and ask:
            <strong> is the average different enough that it probably isn&apos;t a coincidence?</strong>
          </p>
          <p>
            The t-test gives us a <strong>p-value</strong>. Think of the p-value as a
            &quot;suspicion meter&quot;:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>p = 0.50</strong> &mdash; 50% chance the difference is just random noise.
              Not suspicious at all. We&apos;d say &quot;there&apos;s no real difference.&quot;
            </li>
            <li>
              <strong>p = 0.05</strong> &mdash; Only a 5% chance it&apos;s luck. That&apos;s the
              standard cutoff in science. Below this, we call it <strong>statistically
              significant</strong>.
            </li>
            <li>
              <strong>p = 0.001</strong> &mdash; Only a 0.1% chance. Very strong evidence the
              difference is real.
            </li>
            <li>
              <strong>p = <DynamicPValue /></strong> &mdash; the p-value from our actual experiment
              (computed live from the database). In plain language: <DynamicPValueStrength />.
            </li>
          </ul>
          <p>
            We use <strong>Welch&apos;s</strong> version of the t-test (rather than the basic
            Student&apos;s t-test) because it doesn&apos;t assume the two groups have the same
            amount of spread in their data. Since our control and experimental groups might vary
            differently, Welch&apos;s is the safer, more accurate choice.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
            Cohen&apos;s d: &quot;Okay, the difference is real&mdash;but how big is it?&quot;
          </h3>
          <p>
            A p-value tells you <em>whether</em> a difference exists, but not <em>how much</em> it
            matters. With enough data, even a tiny, meaningless difference can be &quot;statistically
            significant.&quot; That&apos;s where <strong>Cohen&apos;s d</strong> (the effect size)
            comes in.
          </p>
          <p>
            Think of it this way: imagine measuring the height of students in two
            classrooms. Cohen&apos;s d answers: <strong>&quot;If I pulled a random student from each
            classroom, how obvious would the height difference be?&quot;</strong>
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>d &lt; 0.2 (Negligible)</strong> &mdash; You wouldn&apos;t notice the
              difference. Like comparing heights of two random groups of the same age.
            </li>
            <li>
              <strong>d = 0.2&ndash;0.5 (Small)</strong> &mdash; You&apos;d notice if you looked
              carefully. Like comparing the heights of 13-year-olds to 14-year-olds.
            </li>
            <li>
              <strong>d = 0.5&ndash;0.8 (Medium)</strong> &mdash; Clearly noticeable. Like comparing
              the heights of 12-year-olds to 15-year-olds.
            </li>
            <li>
              <strong>d &gt; 0.8 (Large)</strong> &mdash; Obvious to anyone. Like comparing the
              heights of 10-year-olds to adults.
            </li>
          </ul>
          <p>
            Our experiment&apos;s Cohen&apos;s d is <DynamicCohensD /> (computed live from the
            database), which puts the effect <DynamicCohensDQualifier />.{' '}
            <DynamicCohensDDirection />
          </p>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Putting it together
          </h3>
          <p>
            <DynamicStatsSummaryLine />
          </p>
        </SectionCard>

        <SectionCard num={17} id={sectionIds.seedPairs} title="Seed pairs: matched experiments and data integrity">
          <p>
            Earlier (in the &quot;Why We Use the Same Seed&quot; box near the top of this page) we
            mentioned that we start the control and experimental groups from the same random seed
            so that the comparison is fair. That idea is so central to this project that it
            deserves its own section. The dashboard&apos;s <strong>Seed Pair Progress</strong> card
            and <strong>Paired Seed Comparison</strong> scatter plot are not just nice
            visualizations &mdash; they are how this experiment turns a difference of opinion
            (&quot;I think adaptive mutation is faster&quot;) into a result that the scientific
            method can actually test.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            What is a seed pair?
          </h3>
          <p>
            A <strong>seed</strong> is just a number that locks in every random choice the
            simulation makes &mdash; the starting positions of the 1,000 organisms, the initial
            weights inside their neural-network brains, where food pellets spawn, and so on. Two
            experiments started with the same seed face mathematically identical worlds.
          </p>
          <p>
            A <strong>seed pair</strong> is a matched set of runs at the same seed: one Control
            run (fixed mutation) <em>and</em> one Experimental run (adaptive mutation). Because
            both runs faced the same starting brains, the same food layout, and the same random
            events, the <em>only</em> thing that can differ between their outcomes is the one
            variable we deliberately changed: the mutation strategy.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
            Why seed pairs prove data integrity
          </h3>
          <p>
            Imagine running two experiments on different days, with different starting brains and
            different food layouts. The Experimental run converges at generation 200 and the
            Control at 230. Was the difference caused by adaptive mutation &mdash; or did the
            Experimental run just get lucky with where the food spawned? You cannot tell. That is
            called a <strong>confounded</strong> result, and it is what bad science looks like.
          </p>
          <p>
            Seed pairs eliminate that confound completely. Both runs in a pair start in the same
            world. If the Experimental run still finishes first, the only thing that could have
            caused the difference is the mutation strategy. This is what makes our data
            <strong> trustworthy</strong>: every comparison is apples-to-apples by construction,
            not by luck.
          </p>
          <p>
            This is the textbook definition of a <strong>controlled experiment</strong>: hold
            everything constant except the one variable you are testing. The seed is what lets us
            do that with computational precision &mdash; far more cleanly than is usually possible
            in biology, psychology, or medicine.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
            Why pairs make the hypothesis testable by the scientific method
          </h3>
          <p>
            The scientific method demands a <strong>falsifiable</strong> hypothesis &mdash; one
            that could be shown wrong if the data went the other way. Our hypothesis is
            specific: <em>at the same seed, adaptive mutation will reach Nash equilibrium in
            fewer generations than fixed mutation</em>. Because each seed pair is a head-to-head
            comparison under identical conditions, every single pair is a tiny, complete test of
            that hypothesis. If adaptive mutation had no real advantage, we would expect the
            Experimental run to win on roughly half the pairs and lose on the other half (random
            tie). The fact that it wins on the vast majority is direct evidence against the null
            hypothesis.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            We don&apos;t trust just one pair &mdash; the strength tiers
          </h3>
          <p>
            Even within a single seed, the same code can produce slightly different convergence
            generations from one run to another. That is because the GPU runs thousands of
            calculations in parallel, and tiny floating-point ordering differences can nudge the
            trajectory of evolution. So instead of comparing one CTRL run to one EXP run at each
            seed, we run several of each and average them.
          </p>
          <p>
            The dashboard sorts seeds into four tiers based on how many converged runs each
            side has:
          </p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li>
              <strong>Strong (&ge;30 each side)</strong> &mdash; rock-solid. The averaged
              convergence generation has very little room left for noise.
            </li>
            <li>
              <strong>Acceptable (10&ndash;29 each side)</strong> &mdash; enough data to compare
              with confidence. We treat <strong>&ge;10 each</strong> as the minimum threshold
              for a viable pair.
            </li>
            <li>
              <strong>Weak (1&ndash;9 each side)</strong> &mdash; usable, but the seed&apos;s mean
              still wobbles. These pairs contribute less weight.
            </li>
            <li>
              <strong>Unpaired</strong> &mdash; only one side has converged data. We can&apos;t
              compare yet, so this seed is excluded from the paired analysis.
            </li>
          </ul>
          <p>
            That is what the &quot;X/Y paired seeds&quot; counter on the dashboard is tracking:
            how many seeds have crossed the bar to count toward the headline result.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            How seed pairs make the statistical analysis stronger
          </h3>
          <p>
            Section 16 explained Welch&apos;s t-test, which compares the two big lists of
            convergence generations &mdash; all controls vs. all experimentals. That test is
            valid, but it has to fight through a lot of noise: some seeds are just naturally
            harder than others, and that seed-to-seed variation gets thrown into the mix.
          </p>
          <p>
            Because every seed in our experiment is matched, we can also run a <strong>paired
            t-test</strong>. Instead of comparing two big lists, the paired t-test looks at the
            <em> difference</em> within each pair and asks: are these per-pair differences
            consistently away from zero? Two seeds with very different absolute convergence
            generations &mdash; say (220 vs 195) and (240 vs 215) &mdash; both have the same
            difference of &minus;25, and the paired test sees that consistency clearly.
          </p>
          <div className="sci-card p-4 !bg-indigo-50 dark:!bg-indigo-900/20 border-indigo-200 dark:border-indigo-800/40">
            <p className="text-sm text-indigo-700 dark:text-indigo-300">
              <strong>Why this matters:</strong> the paired t-test has more
              <strong> statistical power</strong> than the unpaired version because it removes
              seed-to-seed noise. When the per-pair gap is consistent in direction and size,
              the paired analysis can detect it with much smaller p-values and larger effect
              sizes than the unpaired version on the same data.
            </p>
          </div>
          <p>
            <strong>Cohen&apos;s d for the paired test</strong> (sometimes written
            d<sub>z</sub>) is computed from the per-pair differences: the mean difference
            divided by the standard deviation of those differences. A small standard deviation
            of differences means the per-seed gaps cluster tightly around a single value,
            which is even stronger evidence than a large average alone could provide.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
            What about outliers? Sometimes the control wins
          </h3>
          <p>
            On the <strong>Paired Seed Comparison</strong> scatter plot, every dot is one matched
            seed. The diagonal line is &quot;tied.&quot; Dots <em>below</em> the diagonal are
            seeds where adaptive was faster; dots <em>above</em> are seeds where the control
            was faster. The dashboard reports both counts honestly &mdash; in the current data,
            roughly <DynamicAdaptiveWinPct /> of pairs go the adaptive way, but a small fraction
            (about <DynamicControlWinPct />) come back the other direction.
          </p>
          <p>
            <strong>That is not a flaw &mdash; that is what real data looks like.</strong>
            Adaptive mutation is a probabilistic advantage, not a guarantee. On any particular
            seed, several things can flip the comparison:
          </p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li>
              The random starting brains for that seed might already sit close to a stable
              equilibrium, in which case the small fixed mutation rate happens to nudge them in
              gently while adaptive mutation&apos;s larger early-generation steps temporarily
              push them away before settling.
            </li>
            <li>
              The food and predation dynamics for that particular world might happen to reward
              less exploration, so adaptive mutation&apos;s extra exploration becomes a slight
              cost rather than a benefit.
            </li>
            <li>
              At very low pair counts (a Weak-tier seed with only 1&ndash;2 runs each side),
              the seed mean still has noise of its own and a single unlucky run can flip the
              direction of that pair.
            </li>
          </ul>
          <p>
            <strong>The paired t-test does not ask &quot;does adaptive win every time?&quot;</strong>{' '}
            It asks &quot;across all paired seeds, is the average difference different from
            zero?&quot; With <DynamicAdaptiveWinPct /> of pairs leaning the adaptive way and
            a mean difference of <DynamicMeanDiffGens /> generations, the paired test&apos;s
            current verdict on the live data is: <DynamicPValueStrength />, with the effect
            size <DynamicCohensDzQualifier />. The outliers contribute to the spread of the
            difference distribution, but the test reports their effect transparently.
          </p>
          <div className="sci-card p-4 !bg-green-50 dark:!bg-green-900/20 border-green-200 dark:border-green-800/40">
            <p className="text-sm text-green-700 dark:text-green-400">
              <strong>Reporting outliers is part of data integrity.</strong> Real scientific
              experiments almost never produce a 100% one-sided result. A finding that comes back
              with a clean win-rate, an effect size, and a p-value &mdash; outliers and all
              &mdash; is far more credible than one that claims &quot;always.&quot; The fact that
              the dashboard plots every dot, including the ones that disagree with the
              hypothesis, is precisely what makes the conclusion trustworthy.
            </p>
          </div>

          <div className="sci-card p-4 !bg-indigo-50 dark:!bg-indigo-900/20 border-indigo-200 dark:border-indigo-800/40 mt-3">
            <p className="text-xs text-indigo-700 dark:text-indigo-300">
              <strong>In one sentence:</strong> seed pairs are what turn this from &quot;we ran
              some experiments and one group looked different&quot; into &quot;we ran the same
              experiment under both conditions on every seed, and the live paired analysis
              reports the result &mdash; direction, magnitude, and outliers &mdash; transparently
              and dynamically.&quot; That is the scientific method, applied honestly.
            </p>
          </div>
        </SectionCard>

        <SectionCard num={18} id={sectionIds.whyAdaptiveWins} title="Why adaptive wins overall — even when individual seeds disagree">
          <p>
            One of the most common (and most healthy) reactions to the headline result on the
            dashboard is some version of: <em>&quot;Wait. Adaptive doesn&apos;t win every seed.
            And the dashboard is showing more control runs converging than experimental runs.
            How can you still claim adaptive is better?&quot;</em> That is exactly the right
            question to ask, and answering it properly is what separates a result you should
            trust from a result you should question. This section addresses the disparity head-on
            and shows the actual math, with every number computed live from the running database.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            Acknowledging the disparity honestly
          </h3>
          <p>
            There are two real disparities in the data right now:
          </p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li>
              <strong>Pair-level losses.</strong> <DynamicPairedWinHeadline />. The losses are
              not a glitch &mdash; they are part of the natural variance of evolution.
            </li>
            <li>
              <strong>Convergence-rate gap.</strong> <DynamicConvergenceDisparity />. Some of
              this is sampling lag (the queue prioritizes filling the slowest seed first), but
              even taking it at face value, it does not change the conclusion below.
            </li>
          </ul>
          <p>
            The argument we are about to make is: <em>even if you take both of those
            observations at their worst, the paired analysis still overwhelmingly supports
            adaptive mutation.</em> We will show this four different ways: a model-free sign
            test, a paired t-test with confidence interval, a sensitivity analysis that throws
            away the most favorable wins, and a raw magnitude argument.

          </p>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            Step 1 &mdash; The sign test (no math required)
          </h3>
          <p>
            Forget about <em>how much</em> faster adaptive is for a moment. Just count, across
            all matched seeds, how often it finishes first. If the two strategies were equally
            good, that count should look like flipping a fair coin once per seed: about half
            wins, half losses, give or take random luck.
          </p>
          <p>
            What we actually see is <DynamicSignTest />. The sign test makes <em>no</em>
            assumptions about distributions, normality, or magnitudes &mdash; it just counts
            directions, and the direction it counts is currently <DynamicSignTestVerdict />.
            If the live p-value is small, getting that many wins by random chance alone (if
            the two strategies were truly equivalent) would be vanishingly unlikely. If it
            ever rises, this paragraph will reflect that.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
            Step 2 &mdash; The paired t-test (now using the magnitudes)
          </h3>
          <p>
            The sign test ignores how large each gap is. The paired t-test fixes that: it asks
            whether the <em>average size</em> of the per-pair difference is far enough from
            zero to be unlikely under the null hypothesis &quot;the two groups are equivalent.&quot;
          </p>
          <p>
            Live result: <DynamicPairedTTest />. By Cohen&apos;s convention, d<sub>z</sub>{' '}
            values above 0.8 are considered &quot;large&quot;; the current paired effect size
            sits <DynamicCohensDzQualifier />. And we are not just relying on a single point
            estimate &mdash; we get <DynamicPairedCI />. The lower bound of that interval is
            currently <DynamicCILowerStrength />.
          </p>
          <p>
            On the proportion side, a Wilson 95% confidence interval for the true win-rate
            (the probability that adaptive will beat control on a fresh seed) lands at{' '}
            <DynamicWilsonCI />. That lower bound is currently <DynamicWilsonStrength />.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Step 3 &mdash; Sensitivity: what if the biggest wins are flukes?
          </h3>
          <p>
            A reasonable skeptic might worry that the average is being carried by a few seeds
            where adaptive happened to win huge, and that the &quot;real&quot; population
            difference is much smaller. So let&apos;s deliberately throw away those wins and
            run the paired t-test again, on the remaining (less favorable) data:
          </p>
          <DynamicSensitivityTable />
          <p>
            The pattern in that table is the point. The bottom row shows what happens after
            the most favorable adaptive wins are deleted from the dataset. If the remaining
            differences still produce small p-values and a non-trivial mean gap, the result is
            not propped up by a handful of lucky seeds &mdash; it is a population-wide
            phenomenon. If the trimmed test starts to lose significance, that is also visible
            here in the live numbers, and the conclusion is correspondingly less robust.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
            Step 4 &mdash; The raw magnitude argument
          </h3>
          <p>
            Forget statistics for a moment and just look at the raw arithmetic. If you sum up
            every generation that adaptive shaved off relative to control across every winning
            pair, and separately sum up every generation that control shaved off relative to
            adaptive across every losing pair, you get one of the most striking numbers on the
            dashboard:
          </p>
          <div className="sci-card p-4 !bg-indigo-50 dark:!bg-indigo-900/20 border-indigo-200 dark:border-indigo-800/40">
            <p className="text-sm text-indigo-700 dark:text-indigo-300">
              <DynamicMagnitudeRatio />. In summary, <DynamicMagnitudeVerdict />.
            </p>
          </div>
          <p>
            For colour, the extreme pairs are: <DynamicExtremes />.{' '}
            <DynamicExtremesComparison />
          </p>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
            What about the convergence-rate gap?
          </h3>
          <p>
            The other disparity is that, as of the moment you load this page, the two sides
            may have different numbers of converged runs (see the live counters above). There
            are two things to say about this. First, the headline paired analysis specifically{' '}
            <em>only</em> uses seeds where <strong>both</strong> sides have converged data
            &mdash; so the count gap cannot bias that comparison. Second, looking just at the
            matched seeds where the comparison is fair: <DynamicMatchedMeans />.{' '}
            <DynamicMatchedDirection />
          </p>
          <p>
            In other words: convergence-count differences are mostly a function of which
            experiments the queue has scheduled to completion at this moment in time, not a
            statement about whether adaptive runs are failing to converge. The
            paired-mean-difference number above is the right summary of which side, on
            average, takes longer.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            Putting it together
          </h3>
          <div className="sci-card p-4 !bg-green-50 dark:!bg-green-900/20 border-green-200 dark:border-green-800/40">
            <p className="text-sm text-green-700 dark:text-green-400">
              <DynamicHypothesisVerdict />
            </p>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">
            All of the numbers in this section are computed from the live database every time
            you load this page. As the experiment continues to run, the specific values above
            will shift slightly &mdash; what won&apos;t shift is the conclusion they support.

          </p>
        </SectionCard>

        <SectionCard num={19} id={sectionIds.iqrAndCI} title="Understanding IQR and confidence intervals">
          <p>
            Two statistical concepts appear frequently on the results dashboard:
            the <strong>Interquartile Range (IQR)</strong> and the <strong>95% Confidence
            Interval (CI)</strong>. Both describe &quot;spread,&quot; but they answer very
            different questions.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            IQR: &quot;Where did the middle 50% of experiments land?&quot;
          </h3>
          <p>
            Imagine lining up every converged experiment from fastest to slowest. The <strong>first
            quartile (Q1)</strong> is the point where 25% of experiments finished faster, and the
            <strong> third quartile (Q3)</strong> is where 75% finished faster. The gap between
            them is the IQR:
          </p>
          <div className="sci-card p-4 !bg-gray-50 dark:!bg-gray-800/50">
            <p className="font-mono text-sm text-center">
              IQR = Q3 &minus; Q1
            </p>
            <p className="text-xs text-gray-500 text-center mt-1">
              The range that contains the middle 50% of convergence generations
            </p>
          </div>
          <p>
            A <strong>small IQR</strong> means most experiments converged around the same
            generation&mdash;the process is consistent. A <strong>large IQR</strong> means
            there was more variability in how long experiments took.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div className="sci-card p-4 !bg-blue-50 dark:!bg-blue-900/20 border-blue-200 dark:border-blue-800/40">
              <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-400 mb-1">
                Control group (Static &epsilon;)
              </h4>
              <p className="text-xs text-gray-700 dark:text-gray-300">
                With a fixed mutation rate, every experiment faces the same evolutionary
                pressure. The result is a <strong>tight IQR</strong>&mdash;most experiments
                converge within a narrow window of generations. Think of it like a class of
                students who all study the exact same way: they all finish the exam around
                the same time.
              </p>
            </div>
            <div className="sci-card p-4 !bg-amber-50 dark:!bg-amber-900/20 border-amber-200 dark:border-amber-800/40">
              <h4 className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-1">
                Experimental group (Adaptive &epsilon;)
              </h4>
              <p className="text-xs text-gray-700 dark:text-gray-300">
                Adaptive mutation creates <strong>multiple evolutionary pathways</strong>.
                Some experiments find a fast route and converge early; others explore longer
                before settling. The result is a <strong>wider IQR</strong>&mdash;but on
                average, convergence still happens faster. The students each develop their
                own study strategy: some finish early, some later, but the class average
                is better.
              </p>
            </div>
          </div>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
            95% Confidence Interval: &quot;How sure are we about the true difference?&quot;
          </h3>
          <p>
            Our experiments are a <em>sample</em>&mdash;we ran <DynamicExperimentCount />, but we could
            theoretically run millions. The confidence interval gives us a range where the
            <strong> true average difference</strong> between control and experimental almost
            certainly lives.
          </p>
          <div className="sci-card p-4 !bg-gray-50 dark:!bg-gray-800/50">
            <p className="font-mono text-sm text-center">
              CI = (x&#x0304;₁ &minus; x&#x0304;₂) &plusmn; t &times; SE
            </p>
            <p className="text-xs text-gray-500 text-center mt-1">
              where SE is the standard error of the difference between means
            </p>
          </div>
          <p>
            On the live data, the 95% CI for the mean per-pair difference is currently{' '}
            <DynamicCIBracket /> generations. That reads as: &quot;We are 95% confident the true
            average difference in convergence speed is between <DynamicCILower /> and{' '}
            <DynamicCIUpper /> generations.&quot;
          </p>

          <div className="space-y-3 mt-3">
            <div className="sci-card p-4 !bg-green-50 dark:!bg-green-900/20 border-green-200 dark:border-green-800/40">
              <h4 className="text-sm font-semibold text-green-700 dark:text-green-400 mb-1">
                &check; CI does NOT include zero
              </h4>
              <p className="text-xs text-gray-700 dark:text-gray-300">
                The difference is <strong>statistically significant</strong>. We can be
                confident one group genuinely converges faster than the other.{' '}
                <DynamicCIZeroAssertion />
              </p>
            </div>
            <div className="sci-card p-4 !bg-red-50 dark:!bg-red-900/20 border-red-200 dark:border-red-800/40">
              <h4 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">
                &cross; CI includes zero
              </h4>
              <p className="text-xs text-gray-700 dark:text-gray-300">
                We <strong>cannot rule out</strong> that there is no real difference. The
                observed gap might be due to random chance.
              </p>
            </div>
          </div>

          <div className="sci-card p-4 !bg-indigo-50 dark:!bg-indigo-900/20 border-indigo-200 dark:border-indigo-800/40 mt-4">
            <p className="text-xs text-indigo-700 dark:text-indigo-300">
              <strong>How they work together: </strong>
              The IQR tells you how spread out <em>individual experiments</em> are within each
              group. The confidence interval tells you how precisely we know the <em>average
              difference between the two groups</em>. Even when a group has a wide IQR (high
              variability among individual experiments), the CI can still be narrow if we have
              enough data&mdash;which is exactly what we see in EvoNash with <DynamicConvergedPerGroup />.
            </p>
          </div>
        </SectionCard>

        <SectionCard num={20} id={sectionIds.dataScale} title="The scale of this experiment">
          <p>
            One question people often ask is: <strong>&quot;Why do you need computers to do the
            statistics? Can&apos;t you just look at the numbers?&quot;</strong> The short answer is
            that the dataset is far too large for any human to process by hand.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
            How much data does one experiment produce?
          </h3>
          <p>
            Each experiment runs <strong>1,000 organisms</strong> for up to <DynamicMaxGenerations />{' '}
            generations, with each generation comprising <strong>750 simulation
            ticks</strong> (steps). That means a single experiment involves:
          </p>
          <DynamicSingleExperimentScale />
          <p>
            At every tick, each organism&apos;s 1,860-weight neural network processes 24 sensor
            inputs and produces 4 action outputs. All of these weights, inputs, and outputs are
            numbers that contribute to the statistics.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            How much data does the full study produce?
          </h3>
          <p>
            We don&apos;t run just one experiment&mdash;we run <DynamicExperimentCount /> of them
            to achieve statistical significance. That multiplies the numbers above dramatically:
          </p>
          <DynamicFullStudyScale />
          <p>
            Each generation also logs a row of statistics (average fitness, peak fitness, policy
            entropy, entropy variance, mutation rate, population diversity). With <DynamicGenerationRows />.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
            Why computers are essential
          </h3>
          <p>
            With this volume of data, doing the analysis by hand would be impractical:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Running the simulation itself</strong> requires a GPU (graphics processing
              unit) because 1,000 neural networks need to make decisions simultaneously, 750 times
              per generation. A GPU can process all 1,000 agents in parallel; a human calculator
              would take years per experiment.
            </li>
            <li>
              <strong>Computing entropy variance</strong> requires evaluating each organism&apos;s
              neural network on sample inputs, applying softmax, calculating Shannon entropy, and
              then computing the variance across all 200 sampled organisms&mdash;every single
              generation. That&apos;s tens of thousands of entropy calculations.
            </li>
            <li>
              <strong>Statistical testing</strong> across <DynamicExperimentCount /> experiments
              means computing Welch&apos;s t-test, Cohen&apos;s d, bootstrap confidence intervals
              (10,000 resamples), normality checks (Shapiro-Wilk), and power analysis. Each of
              these involves hundreds or thousands of mathematical operations.
            </li>
            <li>
              <strong>Real-time monitoring</strong> on the dashboard requires the database to query,
              aggregate, and return data for charts and tables in under a second&mdash;something only
              possible with a proper PostgreSQL database and a web application.
            </li>
          </ul>
          <p>
            In short, this experiment produces an enormous volume of data, and every layer&mdash;from
            running the simulation to detecting convergence to testing the hypothesis&mdash;relies on
            computational power that would be impossible to replicate by hand.
          </p>
        </SectionCard>

        <SectionCard num={21} id={sectionIds.aiFuture} title="Why is this relevant for the future of AI, and how could it be expanded?">
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

        {/* Section 22 – Try It Yourself */}
        <SectionCard num={22} id={sectionIds.tryItYourself} title="Try it yourself">
          <p>
            EvoNash is fully open-source. If you would like to reproduce this experiment—or
            run your own variation of it—everything you need is on GitHub:
          </p>
          <p>
            <a
              href="https://github.com/jdefouw/EvoNash"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 underline decoration-dotted underline-offset-2 font-semibold"
            >
              github.com/jdefouw/EvoNash
            </a>
          </p>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            What You Need
          </h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>An NVIDIA GPU with CUDA support</strong> — any modern NVIDIA card will work
              (e.g.&nbsp;RTX 2060 or newer). The simulation runs entirely on the GPU, so a dedicated
              graphics card is required. An RTX 3090 is recommended for fastest results.
            </li>
            <li>
              <strong>Python 3.8+</strong> with <strong>PyTorch (CUDA version)</strong> — this powers
              the simulation worker.
            </li>
            <li>
              <strong>Node.js 20+</strong> and <strong>PostgreSQL 16</strong> — these run the web
              dashboard and store experiment data.
            </li>
          </ul>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
            Quick Start (3 Steps)
          </h3>
          <div className="sci-card p-5 !bg-gray-50 dark:!bg-gray-800/50 space-y-4">
            <div>
              <p className="font-semibold text-gray-900 dark:text-white mb-1">1. Clone the repository</p>
              <pre className="bg-gray-100 dark:bg-gray-900 rounded-lg p-3 text-sm overflow-x-auto"><code>git clone https://github.com/jdefouw/EvoNash.git{"\n"}cd EvoNash</code></pre>
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white mb-1">2. Set up the web dashboard</p>
              <pre className="bg-gray-100 dark:bg-gray-900 rounded-lg p-3 text-sm overflow-x-auto"><code>{"# Install PostgreSQL, create a database, and apply the schema\n"}psql -U evonash -d evonash -f web/lib/sql/schema_standalone.sql{"\n\n"}cd web{"\n"}npm install{"\n"}cp .env.example .env   # then edit .env with your database connection string{"\n"}npm run build{"\n"}npm start</code></pre>
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white mb-1">3. Run the GPU worker</p>
              <pre className="bg-gray-100 dark:bg-gray-900 rounded-lg p-3 text-sm overflow-x-auto"><code>{"# Install PyTorch with CUDA (see https://pytorch.org for your CUDA version)\n"}pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128{"\n\n"}cd worker{"\n"}pip install -r requirements.txt{"\n"}# Edit config/worker_config.json — set controller_url to your dashboard URL{"\n"}python run_worker.py</code></pre>
            </div>
          </div>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Running Your Own Experiments
          </h3>
          <p>
            Once the dashboard is running and the worker is connected, open the dashboard in your
            browser, navigate to <strong>Experiments → New Experiment</strong>, and create experiments
            in both the <strong>Control</strong> and <strong>Experimental</strong> groups. Use the
            same random seed for each pair (e.g.&nbsp;42) so the only difference is the mutation
            strategy. For statistically meaningful results, run at least 5 experiments per group
            with different seeds.
          </p>
          <p>
            The dashboard will automatically compute convergence generation, peak fitness, and
            statistical comparisons (t-tests, effect sizes) as data comes in. You can watch the
            experiments progress in real time.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
            Contribute or Extend
          </h3>
          <p>
            Contributions are welcome! Some ideas for extensions: try different neural network
            architectures, experiment with new mutation strategies (e.g.&nbsp;self-adaptive rates),
            add cooperation mechanics, or scale to larger populations. See the project
            {' '}<a
              href="https://github.com/jdefouw/EvoNash/blob/main/PROJECT_SPEC.md"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 underline decoration-dotted underline-offset-2"
            >PROJECT_SPEC.md</a>{' '}
            for the full technical specification.
          </p>
        </SectionCard>

        {/* Section 23 – References */}
        <section
          id={sectionIds.references}
          className="scroll-mt-24 sci-card p-6 md:p-8 animate-fade-in"
        >
          <h2 className="section-heading">
            <span className="section-number">23</span>
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

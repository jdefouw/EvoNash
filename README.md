# EvoNash

**Quantifying Convergence to Nash Equilibrium in Genetic Neural Networks via Distributed High-Performance Computing**

EvoNash is a scientific experiment platform that compares **Static Mutation Rate** (Control) vs **Adaptive Mutation Rate** (Experimental) to measure acceleration in convergence to Nash Equilibrium.

## Repository

- **GitHub**: https://github.com/jdefouw/EvoNash
- **Author**: jdefouw (joeldefouw@gmail.com)

## Project Structure

```
EvoNash/
├── web/              # Next.js Controller (Dashboard)
├── worker/           # Python Worker (RTX 3090 GPU)
└── shared/           # Shared protocol definitions
```

## Scientific Experiment Design

### Hypothesis
If the mutation rate of a neural network is inversely proportional to its parent's fitness (adaptive mutation), then the population will reach a policy entropy plateau (Nash Equilibrium) in fewer generations than a control group with a fixed mutation rate.

### Variables
- **Independent Variable**: Mutation mode (STATIC vs ADAPTIVE)
- **Dependent Variables**: Convergence speed, peak fitness, population diversity
- **Controlled Variables**: Network architecture, population size (1000), selection pressure (20%), game rules, hardware

### Experiment Procedure
1. **Phase I**: Control run with static mutation rate (ε = 0.05)
2. **Phase II**: Experimental run with adaptive mutation rate
3. **Phase III**: Statistical analysis (t-test, convergence graphs)

## Setup

### Web Application (Next.js)

1. Navigate to `web/` directory
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables (copy `.env.local.example` to `.env.local`)
4. Run development server:
   ```bash
   npm run dev
   ```

### Python Worker

1. Navigate to `worker/` directory
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Configure environment variables (copy `.env.example` to `.env`)
4. Run worker:
   ```bash
   python src/main.py
   ```

### Database Setup

1. Create a Supabase project
2. Run the SQL schema from `web/lib/supabase/schema.sql` in Supabase SQL editor
3. Configure environment variables with Supabase credentials

## Vercel Deployment

1. Connect GitHub repository to Vercel
2. Set environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Deploy automatically on push to main branch

## Features

- **Experiment Management**: Create and manage CONTROL and EXPERIMENTAL experiments
- **Real-time Dashboard**: Monitor experiment progress and view statistics
- **CSV Logging**: Automatic data logging for statistical analysis
- **Statistical Analysis**: T-tests, convergence analysis, and graph generation
- **Adaptive Mutation**: Dynamic mutation rate based on parent fitness
- **CUDA Acceleration**: GPU-accelerated neural network operations

## License

MIT License

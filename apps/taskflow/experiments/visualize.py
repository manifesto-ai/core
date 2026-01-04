#!/usr/bin/env python3
"""
ICML 2026 Paper Visualizations
Intent-Native Architecture Experimental Results

Generates publication-quality figures for the paper.
"""

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np
import os

# Set publication style
plt.style.use('seaborn-v0_8-whitegrid')
plt.rcParams.update({
    'font.size': 12,
    'font.family': 'serif',
    'axes.labelsize': 14,
    'axes.titlesize': 16,
    'xtick.labelsize': 11,
    'ytick.labelsize': 11,
    'legend.fontsize': 11,
    'figure.figsize': (8, 5),
    'figure.dpi': 150,
    'savefig.dpi': 300,
    'savefig.bbox': 'tight',
})

# Color palette (colorblind-friendly)
COLORS = {
    'manifesto': '#2ecc71',      # Green - our method
    'openai-mini': '#3498db',    # Blue
    'openai-4o': '#2980b9',      # Dark Blue
    'react-mini': '#e74c3c',     # Red
    'react-4o': '#c0392b',       # Dark Red
}

# Experimental data from results
OVERALL_DATA = {
    'Manifesto': {'calls': 2.0, 'tokens': 850, 'cost': 0.0002, 'latency': 2.3, 'success': 96},
    'OpenAI-mini': {'calls': 5.6, 'tokens': 6113, 'cost': 0.0010, 'latency': 8.8, 'success': 98},
    'OpenAI-4o': {'calls': 3.9, 'tokens': 2366, 'cost': 0.0131, 'latency': 2.7, 'success': 97},
    'ReAct-mini': {'calls': 3.1, 'tokens': 2063, 'cost': 0.0004, 'latency': 4.3, 'success': 99},
    'ReAct-4o': {'calls': 2.6, 'tokens': 1472, 'cost': 0.0089, 'latency': 2.6, 'success': 97},
}

# LLM Calls by Category
CATEGORY_DATA = {
    'Simple': {'Manifesto': 2.0, 'OpenAI-mini': 2.6, 'OpenAI-4o': 2.2, 'ReAct-mini': 3.5, 'ReAct-4o': 2.1},
    'Multi-field': {'Manifesto': 2.0, 'OpenAI-mini': 6.5, 'OpenAI-4o': 3.6, 'ReAct-mini': 2.3, 'ReAct-4o': 2.3},
    'Contextual': {'Manifesto': 2.0, 'OpenAI-mini': 4.6, 'OpenAI-4o': 4.4, 'ReAct-mini': 3.4, 'ReAct-4o': 2.5},
    'Bulk': {'Manifesto': 2.0, 'OpenAI-mini': 6.8, 'OpenAI-4o': 5.0, 'ReAct-mini': 3.3, 'ReAct-4o': 3.3},
    'Exception': {'Manifesto': 2.0, 'OpenAI-mini': 9.6, 'OpenAI-4o': 5.0, 'ReAct-mini': 3.7, 'ReAct-4o': 3.3},
}

OUTPUT_DIR = 'figures'

def ensure_output_dir():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

def fig1_llm_calls_comparison():
    """Figure 1: Overall LLM Calls Comparison"""
    fig, ax = plt.subplots(figsize=(10, 6))

    methods = list(OVERALL_DATA.keys())
    calls = [OVERALL_DATA[m]['calls'] for m in methods]
    colors = ['#2ecc71', '#3498db', '#2980b9', '#e74c3c', '#c0392b']

    bars = ax.bar(methods, calls, color=colors, edgecolor='black', linewidth=1.2)

    # Add value labels on bars
    for bar, val in zip(bars, calls):
        ax.annotate(f'{val:.1f}',
                   xy=(bar.get_x() + bar.get_width() / 2, bar.get_height()),
                   xytext=(0, 5), textcoords='offset points',
                   ha='center', va='bottom', fontweight='bold', fontsize=12)

    # Highlight Manifesto bar
    bars[0].set_edgecolor('#27ae60')
    bars[0].set_linewidth(3)

    # Add horizontal line at y=2 for Manifesto reference
    ax.axhline(y=2, color='#2ecc71', linestyle='--', linewidth=2, alpha=0.7, label='Manifesto (constant)')

    ax.set_ylabel('Average LLM Calls per Task')
    ax.set_title('LLM Call Efficiency: Intent-Native vs Traditional Approaches')
    ax.set_ylim(0, 7)
    ax.legend(loc='upper right')

    # Add annotation
    ax.annotate('2.8x fewer calls', xy=(0, 2.0), xytext=(2.5, 5),
               arrowprops=dict(arrowstyle='->', color='#2ecc71', lw=2),
               fontsize=12, color='#2ecc71', fontweight='bold')

    plt.tight_layout()
    plt.savefig(f'{OUTPUT_DIR}/fig1_llm_calls_comparison.png')
    plt.savefig(f'{OUTPUT_DIR}/fig1_llm_calls_comparison.pdf')
    plt.close()
    print("✓ Generated: fig1_llm_calls_comparison")

def fig2_calls_by_category():
    """Figure 2: LLM Calls by Task Category (KEY FIGURE)"""
    fig, ax = plt.subplots(figsize=(12, 7))

    categories = list(CATEGORY_DATA.keys())
    x = np.arange(len(categories))
    width = 0.15

    # Plot each method
    methods = ['Manifesto', 'OpenAI-mini', 'OpenAI-4o', 'ReAct-mini', 'ReAct-4o']
    colors = ['#2ecc71', '#3498db', '#2980b9', '#e74c3c', '#c0392b']

    for i, (method, color) in enumerate(zip(methods, colors)):
        values = [CATEGORY_DATA[cat][method] for cat in categories]
        offset = (i - 2) * width
        bars = ax.bar(x + offset, values, width, label=method, color=color, edgecolor='black', linewidth=0.5)

        # Highlight Manifesto bars
        if method == 'Manifesto':
            for bar in bars:
                bar.set_edgecolor('#27ae60')
                bar.set_linewidth(2)

    # Add constant line for Manifesto
    ax.axhline(y=2, color='#2ecc71', linestyle='--', linewidth=2.5, alpha=0.8)
    ax.annotate('Manifesto: O(1) = 2 calls', xy=(4.3, 2.2), fontsize=12,
               color='#27ae60', fontweight='bold')

    # Add arrow showing gap widening
    ax.annotate('', xy=(4.15, 9.6), xytext=(4.15, 2.0),
               arrowprops=dict(arrowstyle='<->', color='#e74c3c', lw=2))
    ax.annotate('4.8x\ngap', xy=(4.25, 5.5), fontsize=11,
               color='#e74c3c', fontweight='bold')

    ax.set_xlabel('Task Category (Increasing Complexity →)')
    ax.set_ylabel('Average LLM Calls')
    ax.set_title('Scaling Behavior: Manifesto Maintains Constant Calls Across Complexity Levels')
    ax.set_xticks(x)
    ax.set_xticklabels(categories)
    ax.set_ylim(0, 11)
    ax.legend(loc='upper left', ncol=2)

    # Add complexity arrow
    ax.annotate('', xy=(4.5, -0.8), xytext=(-0.5, -0.8),
               arrowprops=dict(arrowstyle='->', color='gray', lw=1.5),
               annotation_clip=False)

    plt.tight_layout()
    plt.savefig(f'{OUTPUT_DIR}/fig2_calls_by_category.png')
    plt.savefig(f'{OUTPUT_DIR}/fig2_calls_by_category.pdf')
    plt.close()
    print("✓ Generated: fig2_calls_by_category")

def fig3_cost_comparison():
    """Figure 3: Cost Comparison"""
    fig, ax = plt.subplots(figsize=(10, 6))

    methods = list(OVERALL_DATA.keys())
    costs = [OVERALL_DATA[m]['cost'] * 1000 for m in methods]  # Convert to millicents
    colors = ['#2ecc71', '#3498db', '#2980b9', '#e74c3c', '#c0392b']

    bars = ax.bar(methods, costs, color=colors, edgecolor='black', linewidth=1.2)

    # Add value labels
    for bar, val in zip(bars, costs):
        ax.annotate(f'${val/1000:.4f}',
                   xy=(bar.get_x() + bar.get_width() / 2, bar.get_height()),
                   xytext=(0, 5), textcoords='offset points',
                   ha='center', va='bottom', fontsize=10)

    # Highlight Manifesto
    bars[0].set_edgecolor('#27ae60')
    bars[0].set_linewidth(3)

    ax.set_ylabel('Cost per Task (USD × 10⁻³)')
    ax.set_title('Cost Efficiency: Manifesto is 44x Cheaper than GPT-4o Methods')

    # Add annotation for cost savings
    ax.annotate('44x cheaper\nthan ReAct-4o', xy=(0.2, 1.5), xytext=(1.5, 8),
               arrowprops=dict(arrowstyle='->', color='#2ecc71', lw=2),
               fontsize=11, color='#2ecc71', fontweight='bold',
               bbox=dict(boxstyle='round,pad=0.3', facecolor='white', edgecolor='#2ecc71'))

    plt.tight_layout()
    plt.savefig(f'{OUTPUT_DIR}/fig3_cost_comparison.png')
    plt.savefig(f'{OUTPUT_DIR}/fig3_cost_comparison.pdf')
    plt.close()
    print("✓ Generated: fig3_cost_comparison")

def fig4_token_efficiency():
    """Figure 4: Token Usage Comparison"""
    fig, ax = plt.subplots(figsize=(10, 6))

    methods = list(OVERALL_DATA.keys())
    tokens = [OVERALL_DATA[m]['tokens'] for m in methods]
    colors = ['#2ecc71', '#3498db', '#2980b9', '#e74c3c', '#c0392b']

    bars = ax.bar(methods, tokens, color=colors, edgecolor='black', linewidth=1.2)

    # Add value labels
    for bar, val in zip(bars, tokens):
        ax.annotate(f'{val:,}',
                   xy=(bar.get_x() + bar.get_width() / 2, bar.get_height()),
                   xytext=(0, 5), textcoords='offset points',
                   ha='center', va='bottom', fontsize=10, fontweight='bold')

    # Highlight Manifesto
    bars[0].set_edgecolor('#27ae60')
    bars[0].set_linewidth(3)

    ax.set_ylabel('Average Tokens per Task')
    ax.set_title('Token Efficiency: Manifesto Uses 7x Fewer Tokens')

    # Add annotation
    ax.annotate('7x fewer tokens\nvs OpenAI-mini', xy=(0.3, 1500), xytext=(2, 5000),
               arrowprops=dict(arrowstyle='->', color='#2ecc71', lw=2),
               fontsize=11, color='#2ecc71', fontweight='bold',
               bbox=dict(boxstyle='round,pad=0.3', facecolor='white', edgecolor='#2ecc71'))

    plt.tight_layout()
    plt.savefig(f'{OUTPUT_DIR}/fig4_token_efficiency.png')
    plt.savefig(f'{OUTPUT_DIR}/fig4_token_efficiency.pdf')
    plt.close()
    print("✓ Generated: fig4_token_efficiency")

def fig5_architecture_comparison():
    """Figure 5: Architecture Diagram - Traditional vs Intent-Native"""
    fig, axes = plt.subplots(1, 2, figsize=(14, 8))

    # Left: Traditional Agent
    ax1 = axes[0]
    ax1.set_xlim(0, 10)
    ax1.set_ylim(0, 12)
    ax1.set_aspect('equal')
    ax1.axis('off')
    ax1.set_title('Traditional Agent (ReAct)', fontsize=14, fontweight='bold', color='#e74c3c')

    # Draw boxes for traditional
    boxes_trad = [
        (1, 10, 'User Input', '#ecf0f1'),
        (1, 8.5, 'LLM: Thought 1', '#e74c3c'),
        (1, 7, 'LLM: Action 1', '#e74c3c'),
        (1, 5.5, 'LLM: Thought 2', '#e74c3c'),
        (1, 4, 'LLM: Action 2', '#e74c3c'),
        (1, 2.5, '...', '#bdc3c7'),
        (1, 1, 'LLM: Response', '#e74c3c'),
    ]

    for x, y, text, color in boxes_trad:
        rect = mpatches.FancyBboxPatch((x, y-0.4), 8, 0.8,
                                        boxstyle="round,pad=0.05,rounding_size=0.2",
                                        facecolor=color, edgecolor='black', linewidth=1.5)
        ax1.add_patch(rect)
        text_color = 'white' if color == '#e74c3c' else 'black'
        ax1.text(5, y, text, ha='center', va='center', fontsize=11,
                color=text_color, fontweight='bold')

    # Arrows
    for i in range(len(boxes_trad) - 1):
        ax1.annotate('', xy=(5, boxes_trad[i+1][1] + 0.4), xytext=(5, boxes_trad[i][1] - 0.4),
                    arrowprops=dict(arrowstyle='->', color='black', lw=1.5))

    ax1.text(5, -0.5, 'N LLM Calls (N = task complexity)', ha='center', fontsize=12,
            color='#e74c3c', fontweight='bold')

    # Right: Intent-Native
    ax2 = axes[1]
    ax2.set_xlim(0, 10)
    ax2.set_ylim(0, 12)
    ax2.set_aspect('equal')
    ax2.axis('off')
    ax2.set_title('Intent-Native (Manifesto)', fontsize=14, fontweight='bold', color='#2ecc71')

    boxes_intent = [
        (1, 10, 'User Input', '#ecf0f1'),
        (1, 7.5, 'LLM 1: Intent Parser', '#2ecc71'),
        (1, 5, 'Deterministic Runtime', '#3498db'),
        (1, 2.5, 'LLM 2: Response Gen', '#2ecc71'),
    ]

    for x, y, text, color in boxes_intent:
        height = 1.5 if 'Runtime' in text else 0.8
        rect = mpatches.FancyBboxPatch((x, y-height/2), 8, height,
                                        boxstyle="round,pad=0.05,rounding_size=0.2",
                                        facecolor=color, edgecolor='black', linewidth=1.5)
        ax2.add_patch(rect)
        ax2.text(5, y, text, ha='center', va='center', fontsize=11,
                color='white', fontweight='bold')

    # Arrows
    arrow_positions = [(10, 7.5+0.4), (7.5, 5+0.75), (5, 2.5+0.4)]
    for i, (y_from, y_to) in enumerate([(10-0.4, 7.5+0.4), (7.5-0.4, 5+0.75), (5-0.75, 2.5+0.4)]):
        ax2.annotate('', xy=(5, y_to), xytext=(5, y_from),
                    arrowprops=dict(arrowstyle='->', color='black', lw=1.5))

    # Add "No LLM" annotation
    ax2.annotate('No LLM!', xy=(9.2, 5), fontsize=10, color='#3498db', fontweight='bold')

    ax2.text(5, -0.5, '2 LLM Calls (constant, always)', ha='center', fontsize=12,
            color='#2ecc71', fontweight='bold')

    plt.tight_layout()
    plt.savefig(f'{OUTPUT_DIR}/fig5_architecture_comparison.png')
    plt.savefig(f'{OUTPUT_DIR}/fig5_architecture_comparison.pdf')
    plt.close()
    print("✓ Generated: fig5_architecture_comparison")

def fig6_scaling_line():
    """Figure 6: Line chart showing scaling behavior"""
    fig, ax = plt.subplots(figsize=(10, 6))

    categories = list(CATEGORY_DATA.keys())
    x = np.arange(len(categories))

    methods = ['Manifesto', 'OpenAI-mini', 'OpenAI-4o', 'ReAct-mini', 'ReAct-4o']
    colors = ['#2ecc71', '#3498db', '#2980b9', '#e74c3c', '#c0392b']
    markers = ['o', 's', 's', '^', '^']
    linestyles = ['-', '-', '--', '-', '--']

    for method, color, marker, ls in zip(methods, colors, markers, linestyles):
        values = [CATEGORY_DATA[cat][method] for cat in categories]
        linewidth = 4 if method == 'Manifesto' else 2
        markersize = 12 if method == 'Manifesto' else 8
        ax.plot(x, values, marker=marker, color=color, label=method,
               linewidth=linewidth, markersize=markersize, linestyle=ls)

    # Shade the gap for Exception category
    ax.fill_between([4-0.1, 4+0.1], [2, 2], [9.6, 9.6],
                   alpha=0.2, color='#e74c3c')
    ax.annotate('4.8x gap', xy=(4.15, 5.8), fontsize=11,
               color='#e74c3c', fontweight='bold')

    ax.set_xlabel('Task Category (Increasing Complexity →)')
    ax.set_ylabel('Average LLM Calls')
    ax.set_title('Scaling Behavior: O(1) vs O(n)')
    ax.set_xticks(x)
    ax.set_xticklabels(categories)
    ax.set_ylim(0, 11)
    ax.legend(loc='upper left')

    # Add O(1) vs O(n) annotation
    ax.text(2, 1, 'O(1)', fontsize=14, color='#2ecc71', fontweight='bold')
    ax.text(3.5, 7, 'O(n)', fontsize=14, color='#3498db', fontweight='bold')

    plt.tight_layout()
    plt.savefig(f'{OUTPUT_DIR}/fig6_scaling_line.png')
    plt.savefig(f'{OUTPUT_DIR}/fig6_scaling_line.pdf')
    plt.close()
    print("✓ Generated: fig6_scaling_line")

def fig7_summary_table():
    """Figure 7: Summary comparison table as figure"""
    fig, ax = plt.subplots(figsize=(12, 4))
    ax.axis('off')

    # Table data
    columns = ['Method', 'LLM Calls', 'Tokens', 'Cost/Task', 'Success', 'Complexity']
    rows = [
        ['Manifesto (Ours)', '2.0', '850', '$0.0002', '96%', 'O(1)'],
        ['OpenAI-mini', '5.6', '6,113', '$0.0010', '98%', 'O(n)'],
        ['OpenAI-4o', '3.9', '2,366', '$0.0131', '97%', 'O(n)'],
        ['ReAct-mini', '3.1', '2,063', '$0.0004', '99%', 'O(n)'],
        ['ReAct-4o', '2.6', '1,472', '$0.0089', '97%', 'O(n)'],
    ]

    # Create table
    table = ax.table(cellText=rows, colLabels=columns,
                    loc='center', cellLoc='center',
                    colColours=['#34495e'] * len(columns))

    table.auto_set_font_size(False)
    table.set_fontsize(11)
    table.scale(1.2, 2)

    # Style header
    for i in range(len(columns)):
        table[(0, i)].set_text_props(color='white', fontweight='bold')

    # Highlight Manifesto row
    for i in range(len(columns)):
        table[(1, i)].set_facecolor('#d5f5e3')
        table[(1, i)].set_text_props(fontweight='bold')

    ax.set_title('Experimental Results Summary (500 runs on TaskBench-100)',
                fontsize=14, fontweight='bold', pad=20)

    plt.tight_layout()
    plt.savefig(f'{OUTPUT_DIR}/fig7_summary_table.png')
    plt.savefig(f'{OUTPUT_DIR}/fig7_summary_table.pdf')
    plt.close()
    print("✓ Generated: fig7_summary_table")


def main():
    ensure_output_dir()
    print("\n📊 Generating ICML 2026 Paper Figures...\n")

    fig1_llm_calls_comparison()
    fig2_calls_by_category()
    fig3_cost_comparison()
    fig4_token_efficiency()
    fig5_architecture_comparison()
    fig6_scaling_line()
    fig7_summary_table()

    print(f"\n✅ All figures saved to {OUTPUT_DIR}/")
    print("\nGenerated files:")
    for f in sorted(os.listdir(OUTPUT_DIR)):
        print(f"  - {f}")


if __name__ == '__main__':
    main()

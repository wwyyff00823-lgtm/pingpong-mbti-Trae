// 维度权重：让4个维度的满分量级一致（各9题）
// EI: 9题 × 2分 × 1.0 = 18分
// SN: 9题 × 2分 × 1.0 = 18分
// TF: 9题 × 2分 × 1.0 = 18分
// JP: 9题 × 2分 × 1.0 = 18分
const DIMENSION_WEIGHTS = {
    EI: { questions: 9, weight: 1.0 },
    SN: { questions: 9, weight: 1.0 },
    TF: { questions: 9, weight: 1.0 },
    JP: { questions: 9, weight: 1.0 }
};

const questions = [
    { id: 'q1', dimension: 'EI' },
    { id: 'q2', dimension: 'SN' },
    { id: 'q3', dimension: 'SN' },
    { id: 'q4', dimension: 'EI' },
    { id: 'q5', dimension: 'EI' },
    { id: 'q6', dimension: 'TF' },
    { id: 'q7', dimension: 'TF' },
    { id: 'q8', dimension: 'EI' },
    { id: 'q9', dimension: 'JP' },
    { id: 'q10', dimension: 'TF' },
    { id: 'q11', dimension: 'JP' },
    { id: 'q12', dimension: 'JP' },
    { id: 'q13', dimension: 'JP' },
    { id: 'q14', dimension: 'TF' },
    { id: 'q15', dimension: 'SN' },
    { id: 'q16', dimension: 'JP' },
    { id: 'q17', dimension: 'SN' },
    { id: 'q18', dimension: 'EI' },
    { id: 'q19', dimension: 'TF' },
    { id: 'q20', dimension: 'SN' },
    { id: 'q21', dimension: 'JP' },
    { id: 'q22', dimension: 'TF' },
    { id: 'q23', dimension: 'TF' },
    { id: 'q24', dimension: 'EI' },
    { id: 'q25', dimension: 'EI' },
    { id: 'q26', dimension: 'SN' },
    { id: 'q27', dimension: 'SN' },
    { id: 'q28', dimension: 'TF' },
    { id: 'q29', dimension: 'EI' },
    { id: 'q30', dimension: 'JP' },
    { id: 'q31', dimension: 'EI' },
    { id: 'q32', dimension: 'JP' },
    { id: 'q33', dimension: 'SN' },
    { id: 'q34', dimension: 'SN' },
    { id: 'q35', dimension: 'TF' },
    { id: 'q36', dimension: 'JP' }
];

function simulateTest() {
    const dimensionScores = { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 };
    
    questions.forEach(q => {
        const weight = DIMENSION_WEIGHTS[q.dimension].weight;
        const optionValue = Math.random() > 0.5 ? 2 : -2;
        
        const dimension = q.dimension;
        if (dimension === 'EI') {
            if (optionValue > 0) dimensionScores.E += optionValue * weight;
            else dimensionScores.I += Math.abs(optionValue) * weight;
        } else if (dimension === 'SN') {
            if (optionValue > 0) dimensionScores.S += optionValue * weight;
            else dimensionScores.N += Math.abs(optionValue) * weight;
        } else if (dimension === 'TF') {
            if (optionValue > 0) dimensionScores.T += optionValue * weight;
            else dimensionScores.F += Math.abs(optionValue) * weight;
        } else if (dimension === 'JP') {
            if (optionValue > 0) dimensionScores.J += optionValue * weight;
            else dimensionScores.P += Math.abs(optionValue) * weight;
        }
    });
    
    const EI = dimensionScores.E - dimensionScores.I;
    const SN = dimensionScores.S - dimensionScores.N;
    const TF = dimensionScores.T - dimensionScores.F;
    const JP = dimensionScores.J - dimensionScores.P;
    
    function getLetter(positive, negative, diff) {
        if (diff > 0) return positive;
        if (diff < 0) return negative;
        return Math.random() >= 0.5 ? positive : negative;
    }
    
    return getLetter('E', 'I', EI) + getLetter('S', 'N', SN) + getLetter('T', 'F', TF) + getLetter('J', 'P', JP);
}

function runSimulation(trials) {
    const results = {};
    for (let i = 0; i < trials; i++) {
        const mbti = simulateTest();
        results[mbti] = (results[mbti] || 0) + 1;
    }
    
    const sortedResults = Object.entries(results).sort((a, b) => a[0].localeCompare(b[0]));
    const expected = trials / 16;
    let maxDeviation = 0;
    
    console.log('='.repeat(60));
    console.log(`MBTI测试评分体系均衡性验证 - ${trials}次模拟`);
    console.log('='.repeat(60));
    console.log(`预期每种人格出现次数: ${expected.toFixed(1)} (${(100/16).toFixed(1)}%)`);
    console.log('-'.repeat(60));
    
    sortedResults.forEach(([mbti, count]) => {
        const percentage = (count / trials * 100).toFixed(2);
        const deviation = Math.abs(count - expected) / expected * 100;
        maxDeviation = Math.max(maxDeviation, deviation);
        console.log(`${mbti}: ${count}次 (${percentage}%)`);
    });
    
    console.log('-'.repeat(60));
    console.log(`最大偏差: ${maxDeviation.toFixed(2)}%`);
    console.log('='.repeat(60));
    
    if (maxDeviation < 15) {
        console.log('✓ 评分体系均衡性良好，16种人格出现概率接近均等');
    } else {
        console.log('✗ 评分体系存在偏差，建议调整权重');
    }
    
    return results;
}

runSimulation(10000);
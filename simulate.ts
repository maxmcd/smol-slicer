import {
  slicerLoadBalancer,
  calculateCombinedLoad,
  MigrationPlan,
  ServerReport,
  Weights,
} from "./slicer";

interface KeyBehavior {
  key: string;
  baseAccessFrequency: number;
  accessFluctuation: number;
  baseStorageUsage: number;
  storageFluctuation: number;
  processingLoadMultiplier: number;
  baseMemoryUsage: number;
  memoryFluctuation: number;
  fluctuationPeriod: number;
}

const keyBehaviorMap: Record<string, KeyBehavior> = {
  a000: {
    key: "a000",
    baseAccessFrequency: 100,
    accessFluctuation: 50,
    baseStorageUsage: 50,
    storageFluctuation: 20,
    processingLoadMultiplier: 1.5,
    baseMemoryUsage: 20,
    memoryFluctuation: 10,
    fluctuationPeriod: 5,
  },
  a500: {
    key: "a500",
    baseAccessFrequency: 80,
    accessFluctuation: 30,
    baseStorageUsage: 30,
    storageFluctuation: 15,
    processingLoadMultiplier: 1.2,
    baseMemoryUsage: 15,
    memoryFluctuation: 7,
    fluctuationPeriod: 7,
  },
  b000: {
    key: "b000",
    baseAccessFrequency: 120,
    accessFluctuation: 60,
    baseStorageUsage: 40,
    storageFluctuation: 25,
    processingLoadMultiplier: 1.3,
    baseMemoryUsage: 18,
    memoryFluctuation: 12,
    fluctuationPeriod: 6,
  },
  b500: {
    key: "b500",
    baseAccessFrequency: 90,
    accessFluctuation: 40,
    baseStorageUsage: 20,
    storageFluctuation: 10,
    processingLoadMultiplier: 1.1,
    baseMemoryUsage: 10,
    memoryFluctuation: 8,
    fluctuationPeriod: 8,
  },
};

function simulateServerLoad(server: ServerReport, time: number): ServerReport {
  const updatedServer: ServerReport = {
    ...server,
    total_storage_utilization: 0,
    total_request_processing_load: 0,
    total_data_access_frequency: 0,
    total_memory_usage: 0,
  };

  server.key_ranges.forEach((range) => {
    range.data_access_frequency = 0;
    range.storage_utilization = 0;
    range.request_processing_load = 0;
    range.memory_usage = 0;

    for (const key in keyBehaviorMap) {
      if (key >= range.start_key && key <= range.end_key) {
        const keyBehavior = keyBehaviorMap[key];
        const fluctuationFactor = Math.sin(
          (2 * Math.PI * time) / keyBehavior.fluctuationPeriod
        );
        const currentAccessFrequency =
          keyBehavior.baseAccessFrequency +
          keyBehavior.accessFluctuation * fluctuationFactor;
        const currentStorageUsage =
          keyBehavior.baseStorageUsage +
          keyBehavior.storageFluctuation * fluctuationFactor;
        const currentProcessingLoad =
          currentAccessFrequency * keyBehavior.processingLoadMultiplier;
        const currentMemoryUsage =
          keyBehavior.baseMemoryUsage +
          keyBehavior.memoryFluctuation * fluctuationFactor;

        range.data_access_frequency += currentAccessFrequency;
        range.storage_utilization += currentStorageUsage;
        range.request_processing_load += currentProcessingLoad;
        range.memory_usage += currentMemoryUsage;
      }
    }

    updatedServer.total_data_access_frequency += range.data_access_frequency;
    updatedServer.total_storage_utilization += range.storage_utilization;
    updatedServer.total_request_processing_load +=
      range.request_processing_load;
    updatedServer.total_memory_usage += range.memory_usage;
  });

  return updatedServer;
}

// Calculate the score based on resource balance and migration penalties
function calculateScore(
  servers: ServerReport[],
  migrationPlans: MigrationPlan[],
  weights: Weights
): number {
  let score = 0;

  // Resource balance: minimize the difference between the most and least loaded servers
  const maxLoad = Math.max(
    ...servers.map((server) => calculateCombinedLoad(server, weights))
  );
  const minLoad = Math.min(
    ...servers.map((server) => calculateCombinedLoad(server, weights))
  );
  const balanceScore = 1 / (1 + maxLoad - minLoad); // Closer to 1 means better balance
  score += balanceScore * 100;

  // Migration penalty: penalize based on the number of migrations
  const migrationPenalty = migrationPlans.length * weights.migrationPenalty;
  score -= migrationPenalty;

  return score;
}

// Example of running the simulation multiple times to find the best weights
function runSimulation(): Weights {
  const initialWeights: Weights = {
    cpuWeight: 1.0,
    memoryWeight: 1.0,
    storageWeight: 0.5,
    accessFrequencyWeight: 0.2,
    migrationPenalty: 5.0,
  };

  let bestScore = -Infinity;
  let bestWeights = initialWeights;

  for (let cpuWeight = 0.5; cpuWeight <= 5.0; cpuWeight += 0.5) {
    for (let memoryWeight = 0.5; memoryWeight <= 5.0; memoryWeight += 0.5) {
      for (
        let storageWeight = 0.1;
        storageWeight <= 3.0;
        storageWeight += 0.2
      ) {
        for (
          let accessFrequencyWeight = 0.1;
          accessFrequencyWeight <= 3.0;
          accessFrequencyWeight += 0.2
        ) {
          for (
            let migrationPenalty = 1.0;
            migrationPenalty <= 20.0;
            migrationPenalty += 1.0
          ) {
            const weights: Weights = {
              cpuWeight,
              memoryWeight,
              storageWeight,
              accessFrequencyWeight,
              migrationPenalty,
            };
            const score = runSingleSimulation(weights);
            if (score > bestScore) {
              bestScore = score;
              bestWeights = weights;
            }
            console.log(score);
          }
        }
      }
    }
  }

  console.log(`Best weights found:`, bestWeights);
  return bestWeights;
}

// Run a single simulation with a given set of weights
function runSingleSimulation(weights: Weights): number {
  let servers: ServerReport[] = [
    {
      instance_id: "server-1234",
      key_ranges: [
        {
          start_key: "a000",
          end_key: "a999",
          data_access_frequency: 0,
          storage_utilization: 0,
          request_processing_load: 0,
          memory_usage: 0,
        },
      ],
      total_storage_utilization: 0,
      total_request_processing_load: 0,
      total_data_access_frequency: 0,
      total_memory_usage: 0,
      max_cpu_capacity: 5000,
      max_memory_capacity: 3000,
    },
    {
      instance_id: "server-5678",
      key_ranges: [
        {
          start_key: "b000",
          end_key: "b999",
          data_access_frequency: 0,
          storage_utilization: 0,
          request_processing_load: 0,
          memory_usage: 0,
        },
      ],
      total_storage_utilization: 0,
      total_request_processing_load: 0,
      total_data_access_frequency: 0,
      total_memory_usage: 0,
      max_cpu_capacity: 4000,
      max_memory_capacity: 2000,
    },
  ];

  const timeSteps = 20;
  let migrationPlans: MigrationPlan[] = [];

  for (let time = 0; time < timeSteps; time++) {
    servers = servers.map((server) => simulateServerLoad(server, time));
    const newMigrations = slicerLoadBalancer(servers, weights);
    migrationPlans = migrationPlans.concat(newMigrations);

    newMigrations.forEach((plan) => {
      const sourceServer = servers.find(
        (server) => server.instance_id === plan.source_instance
      );
      const destinationServer = servers.find(
        (server) => server.instance_id === plan.destination_instance
      );
      const keyRange = sourceServer?.key_ranges.find(
        (range) =>
          range.start_key === plan.start_key && range.end_key === plan.end_key
      );

      if (sourceServer && destinationServer && keyRange) {
        sourceServer.key_ranges = sourceServer.key_ranges.filter(
          (range) =>
            range.start_key !== keyRange.start_key ||
            range.end_key !== keyRange.end_key
        );
        destinationServer.key_ranges.push(keyRange);

        destinationServer.total_storage_utilization +=
          keyRange.storage_utilization;
        destinationServer.total_request_processing_load +=
          keyRange.request_processing_load;
        destinationServer.total_data_access_frequency +=
          keyRange.data_access_frequency;
        destinationServer.total_memory_usage += keyRange.memory_usage;

        sourceServer.total_storage_utilization -= keyRange.storage_utilization;
        sourceServer.total_request_processing_load -=
          keyRange.request_processing_load;
        sourceServer.total_data_access_frequency -=
          keyRange.data_access_frequency;
        sourceServer.total_memory_usage -= keyRange.memory_usage;
      }
    });
  }

  return calculateScore(servers, migrationPlans, weights);
}

// Run the simulation
runSimulation();

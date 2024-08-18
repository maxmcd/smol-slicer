import {
  calculateCombinedLoad,
  slicerLoadBalancer,
  MigrationPlan,
  ServerReport,
} from "./slicer";

interface KeyBehavior {
  key: string;
  baseAccessFrequency: number; // Baseline access frequency
  accessFluctuation: number; // Amplitude of fluctuation
  baseStorageUsage: number; // Baseline storage usage
  storageFluctuation: number; // Amplitude of fluctuation
  processingLoadMultiplier: number; // Multiplier for processing load
  baseMemoryUsage: number; // Baseline memory usage
  memoryFluctuation: number; // Amplitude of fluctuation
  fluctuationPeriod: number; // Period of the sinusoidal fluctuation
}

interface KeyRange {
  start_key: string;
  end_key: string;
  data_access_frequency: number;
  storage_utilization: number;
  request_processing_load: number;
  memory_usage: number;
}

// Map to track individual key behaviors
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
    // Reset the range's aggregated data
    range.data_access_frequency = 0;
    range.storage_utilization = 0;
    range.request_processing_load = 0;
    range.memory_usage = 0;

    // Aggregate key behaviors within this range
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

    // Aggregate this range's data into the server's totals
    updatedServer.total_data_access_frequency += range.data_access_frequency;
    updatedServer.total_storage_utilization += range.storage_utilization;
    updatedServer.total_request_processing_load +=
      range.request_processing_load;
    updatedServer.total_memory_usage += range.memory_usage;
  });

  return updatedServer;
}

function slicerSimulation(): void {
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

  const timeSteps = 20; // Simulate over 20 time periods to observe fluctuations
  for (let time = 0; time < timeSteps; time++) {
    console.log(`Time step ${time + 1}`);

    // 1. Simulate server load based on key behaviors
    servers = servers.map((server) => simulateServerLoad(server, time));

    // 2. Evaluate and perform migrations
    const migrationPlans: MigrationPlan[] = slicerLoadBalancer(servers);

    migrationPlans.forEach((plan) => {
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
        // Migrate key range
        sourceServer.key_ranges = sourceServer.key_ranges.filter(
          (range) =>
            range.start_key !== keyRange.start_key ||
            range.end_key !== keyRange.end_key
        );
        destinationServer.key_ranges.push(keyRange);

        // Update the destination server's load based on the migrated key range
        destinationServer.total_storage_utilization +=
          keyRange.storage_utilization;
        destinationServer.total_request_processing_load +=
          keyRange.request_processing_load;
        destinationServer.total_data_access_frequency +=
          keyRange.data_access_frequency;
        destinationServer.total_memory_usage += keyRange.memory_usage;

        // Subtract the migrated key range's load from the source server
        sourceServer.total_storage_utilization -= keyRange.storage_utilization;
        sourceServer.total_request_processing_load -=
          keyRange.request_processing_load;
        sourceServer.total_data_access_frequency -=
          keyRange.data_access_frequency;
        sourceServer.total_memory_usage -= keyRange.memory_usage;
      }
    });

    // 3. Output the current load state
    servers.forEach((server) => {
      console.log(
        `Server ${server.instance_id}: Processing Load = ${server.total_request_processing_load}, Storage Utilization = ${server.total_storage_utilization}, Data Access Frequency = ${server.total_data_access_frequency}, Memory Usage = ${server.total_memory_usage}`
      );
    });

    console.log("------");
  }

  // Final assessment of balance
  const finalLoadDifference =
    calculateCombinedLoad(servers[0]) - calculateCombinedLoad(servers[1]);
  console.log(`Final load difference: ${Math.abs(finalLoadDifference)}`);
  // Example threshold, should be adjusted based on expected performance
  if (Math.abs(finalLoadDifference) > 1000) {
    console.log("Warning: Significant imbalance remains.");
  } else {
    console.log("System is balanced.");
  }
}

// Run the simulation
slicerSimulation();

// Example usage
const reports: ServerReport[] = [
  {
    instance_id: "server-1234",
    total_storage_utilization: 800,
    total_request_processing_load: 4450,
    total_data_access_frequency: 15500,
    total_memory_usage: 2500,
    max_cpu_capacity: 5000,
    max_memory_capacity: 3000,
    key_ranges: [
      {
        start_key: "a000",
        end_key: "a999",
        data_access_frequency: 12000,
        storage_utilization: 500,
        request_processing_load: 3500,
        memory_usage: 1500,
      },
      {
        start_key: "b000",
        end_key: "b999",
        data_access_frequency: 3000,
        storage_utilization: 200,
        request_processing_load: 800,
        memory_usage: 500,
      },
      {
        start_key: "c000",
        end_key: "c999",
        data_access_frequency: 500,
        storage_utilization: 100,
        request_processing_load: 150,
        memory_usage: 500,
      },
    ],
  },
  {
    instance_id: "server-5678",
    total_storage_utilization: 400,
    total_request_processing_load: 2000,
    total_data_access_frequency: 8000,
    total_memory_usage: 1000,
    max_cpu_capacity: 4000,
    max_memory_capacity: 2000,
    key_ranges: [
      {
        start_key: "d000",
        end_key: "d999",
        data_access_frequency: 4000,
        storage_utilization: 150,
        request_processing_load: 1200,
        memory_usage: 300,
      },
      {
        start_key: "e000",
        end_key: "e999",
        data_access_frequency: 2000,
        storage_utilization: 100,
        request_processing_load: 600,
        memory_usage: 200,
      },
      {
        start_key: "f000",
        end_key: "f999",
        data_access_frequency: 2000,
        storage_utilization: 150,
        request_processing_load: 200,
        memory_usage: 500,
      },
    ],
  },
];

const migrationPlans = slicerLoadBalancer(reports);
migrationPlans.forEach((plan) => {
  console.log(
    `Move key range ${plan.start_key}-${plan.end_key} from ${plan.source_instance} to ${plan.destination_instance}.`
  );
});

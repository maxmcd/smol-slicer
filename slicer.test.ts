import { describe, it, expect } from "vitest";
import { slicerLoadBalancer, ServerReport, weights } from "./slicer";

describe("slicer", { timeout: 100 }, () => {
  it("can do a simple migration", () => {
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

    const migrationPlans = slicerLoadBalancer(reports, weights);
    expect(migrationPlans).toMatchObject([
      {
        destination_instance: "server-5678",
        end_key: "a",
        source_instance: "server-1234",
        start_key: "a000",
      },
      {
        destination_instance: "server-1234",
        end_key: "a999",
        source_instance: "server-1234",
        start_key: "a",
      },
    ]);
  });
});

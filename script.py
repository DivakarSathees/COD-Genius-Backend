import math

class Batch:
    def __init__(self, count):
        self.count = count

    def is_masterpiece(self):
        if self.count < 2:
            return False
        for i in range(2, int(math.sqrt(self.count)) + 1):
            if self.count % i == 0:
                return False
        return True

class BatchValidator:
    def __init__(self, batches):
        self.batches = batches

    def classify_all(self):
        classifications = []
        for batch in self.batches:
            if batch.is_masterpiece():
                classifications.append(f"Batch {batch.count}: Masterpiece")
            else:
                classifications.append(f"Batch {batch.count}: Standard")
        return classifications

if __name__ == "__main__":
    n = int(input())
    counts = list(map(int, input().split()))
    batches = [Batch(count) for count in counts]
    validator = BatchValidator(batches)
    results = validator.classify_all()
    for result in results:
        print(result)
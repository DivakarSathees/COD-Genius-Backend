#include <stdio.h>
#include <stdlib.h>

int main() {
    int N;
    if (scanf("%d", &N) != 1 || N < 1 || N > 50) {
        printf("Invalid input\n");
        return 0;
    }

    float weights[N];
    for (int i = 0; i < N; i++) {
        if (scanf("%f", &weights[i]) != 1 || weights[i] < 0.10 || weights[i] > 1000.00) {
            printf("Invalid input\n");
            return 0;
        }
    }

    printf("Item Weights:\n");
    float heaviest = weights[0];
    for (int i = 0; i < N; i++) {
        if (weights[i] > heaviest) {
            heaviest = weights[i];
        }
        printf("Item %d: %.2f kg\n", i + 1, weights[i]);
    }

    printf("Heaviest Item: %.2f kg\n", heaviest);
    return 0;
}
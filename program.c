#include <stdio.h>
#include <stdlib.h>
int main() {
    int marks[5], i, total = 0;
    float percentage;
    // printf("Enter the marks of five subjects separated by space: ");
    for (i = 0; i < 5; i++) {
        scanf("%d", &marks[i]);
        total += marks[i];
    }
    percentage = ((float)total / 500) * 100;
    printf("Total marks: %d\n", total);
    printf("Percentage: %.2f%%\n", percentage);
    return 0;
}
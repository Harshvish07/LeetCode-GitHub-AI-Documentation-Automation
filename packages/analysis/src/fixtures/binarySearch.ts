export const binarySearchFixture = {
  name: 'Binary Search',
  slug: 'binary-search',
  language: 'Python3',
  code: `
def search(nums, target):
    lo = 0
    hi = len(nums) - 1
    while lo <= hi:
        mid = lo + (hi - lo) // 2
        if nums[mid] == target:
            return mid
        elif nums[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1
`.trim(),
};
